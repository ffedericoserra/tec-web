// query specifiche del useo selezionati
const urlParams = new URLSearchParams(window.location.search);
const currentMuseumId = urlParams.get('museumId');
const currentMuseumName = urlParams.get('museumName');

console.log("Stiamo lavorando sul museo:", currentMuseumName, "con ID:", currentMuseumId);