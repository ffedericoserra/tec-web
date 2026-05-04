const dialog = document.getElementById('loginDialog');
const openBtn = document.getElementById('loginBtn');
const cancelBtn = document.getElementById('loginCancel');

openBtn.addEventListener('click', () => dialog.showModal());
cancelBtn.addEventListener('click', () => dialog.close());
