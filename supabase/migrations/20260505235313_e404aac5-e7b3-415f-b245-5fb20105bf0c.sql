-- Remove o trigger que bloqueava o signup antes da validação.
-- A whitelist passa a ser validada pelo app logo após o login (Google ou email/senha),
-- evitando o erro "failed to sign in with vendor" e garantindo que toda tentativa
-- de cadastro registre uma solicitação visível ao admin.
DROP TRIGGER IF EXISTS enforce_whitelist_on_signup ON auth.users;