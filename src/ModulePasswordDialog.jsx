import React, { useState } from 'react';

/** Shared self-service password dialog for native module sidebars. */
export default function ModulePasswordDialog({ request, onClose, onSuccess }) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.newPassword !== values.repeatPassword) {
      setMessage('The new passwords do not match.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await request('auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }) });
      onSuccess?.('Password updated successfully.');
      onClose();
    } catch (error) {
      setMessage(error.message || 'Password update failed.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="mm2-modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mm2-modal mm2-account-modal mfs-module-password-dialog" role="dialog" aria-modal="true" aria-labelledby="module-password-title">
      <header><div><span className="mm2-eyebrow">MODULE ACCOUNT</span><h2 id="module-password-title">Change password</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      <form onSubmit={submit}>
        <div className="mm2-form-grid">
          <label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required /></label>
          <label>New password<input type="password" name="newPassword" autoComplete="new-password" required /></label>
          <label>Repeat new password<input type="password" name="repeatPassword" autoComplete="new-password" required /></label>
        </div>
        {message && <div className="mm2-form-error" role="alert">{message}</div>}
        <footer><button type="button" className="mm2-button secondary" onClick={onClose}>Cancel</button><button className="mm2-button primary" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</button></footer>
      </form>
    </section>
  </div>;
}
