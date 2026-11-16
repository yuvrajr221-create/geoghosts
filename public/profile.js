const username = document.body.dataset.username;
const form = document.getElementById('gb-form');
const list = document.getElementById('gb-list');
const errorBox = document.getElementById('gb-error');

async function request(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    await request(`/api/pages/${encodeURIComponent(username)}/guestbook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: form.author.value, message: form.message.value }),
    });
    location.reload();
  } catch (err) {
    errorBox.textContent = err.message;
    button.disabled = false;
  }
});

list?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button || !confirm('Delete this guestbook entry?')) return;
  try {
    await request(`/api/guestbook/${button.dataset.delete}`, { method: 'DELETE' });
    button.closest('li').remove();
  } catch (err) {
    errorBox.textContent = err.message;
  }
});
