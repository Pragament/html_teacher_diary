// ================================================================
//  FILE UPLOADS MODULE (Phase 2)
// ================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES_PER_PERIOD = 10;
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB total per period
const BUCKET_NAME = 'period_files';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
    if (!mimeType) return '📎';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📑';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '🖥️';
    if (mimeType.includes('text')) return '📝';
    return '📎';
}

function validateFileForPeriod(file, existingFiles = []) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return { valid: false, error: `File "${file.name}" exceeds the 10 MB limit.` };
    }
    
    if (existingFiles.length >= MAX_FILES_PER_PERIOD) {
        return { valid: false, error: `Maximum of ${MAX_FILES_PER_PERIOD} files allowed per period.` };
    }
    
    const currentTotalSize = existingFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
        return { valid: false, error: `Adding "${file.name}" exceeds the 50 MB total limit for this period.` };
    }
    
    return { valid: true };
}

/**
 * Uploads a file to Supabase storage.
 * @param {File} file 
 * @param {string} teacherId 
 * @param {string} dateStr 
 * @param {number} periodNumber 
 * @returns {Promise<string>} The storage path
 */
async function uploadPeriodFile(file, teacherId, dateStr, periodNumber) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    
    // Create unique filename to prevent collisions
    const uuid = generateId(); 
    const ext = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${teacherId}/${dateStr}/period_${periodNumber}/${uuid}_${safeName}`;
    
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
            upsert: false,
            contentType: file.type || 'application/octet-stream'
        });
        
    if (error) {
        throw new Error(`Upload failed for ${file.name}: ${error.message}`);
    }
    
    return data.path; // e.g. "teacher_id/2026-07-18/period_1/..."
}

/**
 * Generates a signed URL for a given storage path
 * @param {string} storagePath 
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(storagePath) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    // First try cache or memoized map if needed, but for security just fetch
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
        
    if (error) {
        console.error('Error fetching signed URL for', storagePath, error);
        return null;
    }
    
    return data.signedUrl;
}

/**
 * Bulk generate signed URLs
 * @param {string[]} paths 
 */
async function getSignedUrls(paths) {
    const client = getSupabaseClient();
    if (!client || !paths || paths.length === 0) return {};
    
    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS);
        
    if (error) {
        console.error('Error fetching signed URLs', error);
        return {};
    }
    
    const urlMap = {};
    for (const item of data) {
        if (!item.error) {
            urlMap[item.path] = item.signedUrl;
        }
    }
    return urlMap;
}

/**
 * Fetch attachments for a specific entry ID from the database
 * @param {string} entryId 
 * @returns {Promise<Array>} List of attachments
 */
async function fetchAttachmentsForEntry(entryId) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('attachments')
        .select('*')
        .eq('entry_id', entryId);
        
    if (error) {
        console.error('Error fetching attachments:', error);
        return [];
    }
    
    // Enhance with signed URLs
    const paths = data.map(d => d.file_url).filter(url => url && !url.startsWith('http'));
    const signedUrls = await getSignedUrls(paths);
    
    return data.map(d => ({
        id: d.id,
        name: d.file_name,
        type: d.file_type,
        size: d.file_size,
        path: d.file_url, // We stored the storage path in file_url
        url: d.file_url.startsWith('http') ? d.file_url : (signedUrls[d.file_url] || '#'),
        isExisting: true
    }));
}

/**
 * Deletes an attachment from both Storage and Database
 * @param {string} attachmentId 
 * @param {string} storagePath 
 */
async function deleteAttachment(attachmentId, storagePath) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    
    // 1. Delete from DB
    if (attachmentId) {
        const { error: dbError } = await client
            .from('attachments')
            .delete()
            .eq('id', attachmentId);
            
        if (dbError) throw new Error('Failed to delete attachment record: ' + dbError.message);
    }
    
    // 2. Delete from Storage
    if (storagePath && !storagePath.startsWith('http')) {
        const { error: storageError } = await client.storage
            .from(BUCKET_NAME)
            .remove([storagePath]);
            
        if (storageError) console.warn('Failed to delete file from storage:', storageError);
    }
    
    return true;
}

// Expose globals
window.FileUploadService = {
    formatFileSize,
    getFileIcon,
    validateFileForPeriod,
    uploadPeriodFile,
    getSignedUrl,
    getSignedUrls,
    fetchAttachmentsForEntry,
    deleteAttachment,
    MAX_FILE_SIZE_BYTES,
    MAX_FILES_PER_PERIOD,
    MAX_TOTAL_SIZE_BYTES
};
