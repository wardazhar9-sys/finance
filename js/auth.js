/* ============================================================
   auth.js  —  signup / login / logout (localStorage simulated)
   NOTE: This is a client-side demo. Passwords are NOT secure.
   ============================================================ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function syncPasswordToggle(btn, input) {
  const visible = input.type === 'text';
  btn.classList.toggle('is-visible', visible);
  btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
  btn.innerHTML = `<i class="fa-solid fa-eye${visible ? '' : '-slash'}" aria-hidden="true"></i>`;
}

function initPasswordToggles(root) {
  (root || document).querySelectorAll('.toggle-visibility').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    const input = document.getElementById(btn.dataset.target);
    if (!input) return;

    syncPasswordToggle(btn, input);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.type = input.type === 'password' ? 'text' : 'password';
      syncPasswordToggle(btn, input);
      input.focus();
    });
  });
}

function setFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field) field.classList.toggle('field-invalid', Boolean(message));
  if (error) error.textContent = message || '';
}

function validateEmail(email) {
  if (!email) return 'Email is required.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
  return '';
}

function validatePassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (/\s/.test(password)) return 'Password cannot contain spaces.';
  return '';
}

function validateName(name) {
  if (!name) return 'Full name is required.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 80) return 'Name must be 80 characters or fewer.';
  if (!/[A-Za-z]/.test(name)) return 'Name must include at least one letter.';
  if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(name)) return 'Name can only contain letters, spaces, and basic punctuation.';
  return '';
}

function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password.';
  if (confirmPassword !== password) return 'Passwords do not match.';
  return '';
}

function bindAuthInputClear(pairs) {
  pairs.forEach(({ field, error }) => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('input', () => {
      setFieldError(field, error, '');
      const formError = document.getElementById('formError');
      if (formError) formError.textContent = '';
    });
  });
}

function focusFirstInvalid() {
  const first = document.querySelector('.field input.field-invalid, .field select.field-invalid');
  if (first) first.focus();
}

function handleSignup(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const err = document.getElementById('formError');
  if (err) err.textContent = '';

  const nameError = validateName(name);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const confirmPasswordError = validateConfirmPassword(password, confirmPassword);

  setFieldError('name', 'nameError', nameError);
  setFieldError('email', 'emailError', emailError);
  setFieldError('password', 'passwordError', passwordError);
  setFieldError('confirmPassword', 'confirmPasswordError', confirmPasswordError);

  if (nameError || emailError || passwordError || confirmPasswordError) {
    if (err) err.textContent = 'Please fix the highlighted fields before continuing.';
    focusFirstInvalid();
    return false;
  }

  if (findUserByEmail(email)) {
    setFieldError('email', 'emailError', 'An account with this email already exists.');
    if (err) err.textContent = 'Please fix the highlighted fields before continuing.';
    focusFirstInvalid();
    return false;
  }

  const users = getUsers();
  const user = { id: uid(), name, email, password, plan: 'free', demoWallet: 25 };
  users.push(user);
  saveUsers(users);
  setSession(user.id);
  showTransition('Setting up your account...', 'onboarding.html');
  return false;
}

function handleLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('formError');
  if (err) err.textContent = '';

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);

  setFieldError('email', 'emailError', emailError);
  setFieldError('password', 'passwordError', passwordError);

  if (emailError || passwordError) {
    if (err) err.textContent = 'Please fix the highlighted fields before continuing.';
    focusFirstInvalid();
    return false;
  }

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    if (err) err.textContent = 'Invalid email or password.';
    setFieldError('email', 'emailError', '');
    setFieldError('password', 'passwordError', '');
    return false;
  }

  setSession(user.id);
  updateCurrentUser({});
  const data = getData();
  const dest = data.profile.onboarded ? 'dashboard.html' : 'onboarding.html';
  showTransition('Welcome back...', dest);
  return false;
}

function logout() {
  clearSession();
  showTransition('Signing out...', '../index.html');
}

function initAuthPage() {
  initPasswordToggles();

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
    bindAuthInputClear([
      { field: 'name', error: 'nameError' },
      { field: 'email', error: 'emailError' },
      { field: 'password', error: 'passwordError' },
      { field: 'confirmPassword', error: 'confirmPasswordError' },
    ]);
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    bindAuthInputClear([
      { field: 'email', error: 'emailError' },
      { field: 'password', error: 'passwordError' },
    ]);
  }
}

window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.logout = logout;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
  initAuthPage();
}
