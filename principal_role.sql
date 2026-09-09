INSERT INTO public.users (id, email, role)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'your_email'), 
    'your_email', 
    'principal'
)
ON CONFLICT (id) 
DO UPDATE SET role = 'principal';