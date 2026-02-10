# FAQ Progetto

---

### Aspetti Legali
Gli aspetti legali come privacy, cookie etc. devono essere rispettati? Tendenzialmente no, non essendo un progetto pubblicato non si applicano.

---

### Gestione Domande e LLM
Nel pdf si dice che le domande che è possibile porre sono limitate (numero fisso), l’LLM mappa le domande a quelle disponibili, eppure negli esempi forniti le domande sono molto generiche: dobbiamo anche pensare a domande di approfondimento o aperte? Il sistema pensa ad un numero limitato di domande. La domanda non viene passata così com’è all’LLM, bensì l’LLM fa da “router” per decidere quale domanda predefinita somiglia di più a quella inserita dall’utente. L'elenco delle domande accettabili può essere ampliato in base al wording utilizzato, che può variare da utente a utente.

---

### Indicazioni e Precisione (K.I.S.S.)
L’agente dovrebbe dare delle indicazioni (dov’è il bagno? etc.). Qual è il livello di precisione richiesto? Ha senso sviluppare un motore che calcoli la posizione di partenza e di destinazione? Regola d’oro: K.I.S.S. (Keep It Simple and Stupid). In questo caso, basta dare una indicazione assoluta (esempio: dov’è il bagno? in fondo al corridoio A.) che non dipenda dalla posizione.

---

### Docker e Ambiente di Sviluppo
Quale docker possiamo utilizzare? Posso proporre la mia immagine docker? No. I tecnici esigono che usiate quelle fornite da loro. Esse arrivano con versioni di mongo, docker, node, etc. predefinite. Le dipendenze di cui necessitate potrete installarle all’interno dei docker predefiniti. (In un docker c’è node/express/etc.; nell’altro c’è mongo e basta). E' stato messo a disposizione un documento chiamato "Come attivare i docker di dipartimento".

---

### Tempistiche
Sui tempi da calcolare, quanto bisogna essere specifici? KISS: indicazioni di massima anche sui tempi.

---

### Struttura del Lavoro
Dove si consiglia di orientare il lavoro primariamente? Consigli su come strutturarlo? L’ideale è partire dal marketplace, facendo una interfaccia e-commerce tipica e a tabella, e poi iterativamente migliorare.

---

### Geolocalizzazione e Orientamento
Se la geolocalizzazione non può essere precisa al centimetro, specie in un edificio piccolo, come la possiamo sfruttare? La geolocalizzazione serve a dare una indicazione di massima (con precisione da GPS civile, 5m o inferiore) su dove si trova l’utente, e quali sono i quadri più vicini. Altra cosa interessante è l’orientamento che è abbastanza affidabile (”l’utente sta andando verso est”).

---

### File di Configurazione
Cosa si intende per “file di configurazione”? E come viene creato? Ci sono due versioni del progetto: abbiamo quindi un file di configurazione generico che posso utilizzare per tutti i musei, oppure quello personalizzato su quel museo. Ecco, Il file di configurazione contiene: immagine di copertina, contenuti, cartina… È tendenzialmente un file JSON generico per il primo caso e molto strutturato nel secondo caso. Non dovete sviluppare una interfaccia per creare un file di configurazione, diamo per scontato che esista già.

---

### Costi API LLM
Le chiamate alle API degli LLM hanno un costo? Cercare opzioni convenienti. Magari risorse come: https://github.com/cheahjs/free-llm-api-resources