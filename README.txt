# Insegnamento di Tecnologie Web
# CdS In Informatica   
# (A.A. 2025-26)

# Progetto ArtAround 18-27 
 
# READ ME DEL PROGETTO ARTAROUND

## Nome del gruppo: 
MSZ


## Membri del gruppo   

* Nome e cognome: `Matteo Mazzetti`, matricola: `0001161552`, mail: `matteo.mazzetti13@studio.unibo.it`
* Nome e cognome: `Andrea Ziccone`, matricola: `0001161895 `, mail: `andrea.ziccone@studio.unibo.it `
* Nome e cognome: `Federico Serra`, matricola: `0001161283`, mail: `federico.serra7@studio.unibo.it`
* LLM (nome e versione e licenza): Gemini 3.1 Pro, Codex 5.4, Claude 4.5


## Tipo progetto
18-27 

## Data di disponibilità delle applicazioni
12 Settembre 2026 

## Locazione del progetto:

* URI del marketplace: https://site242557.tw.cs.unibo.it/marketplace/pages/homepage.html
* URI del navigator: https://site242557.tw.cs.unibo.it/
* Altri URI rilevanti: 

## Organizzazione dei sorgenti

.env                          
data/
└── museums/                  // file di configurazione per i musei
    ├── uffizi.json
    └── mambo.json
uploads/                       // dir contenente tutte le immagini utilizzate per item, musei, movimenti artistici, ecc
├── artists/                   
├── contents/                  
├── maps/                      
├── movements/                
├── museums/                   
├── placeholders/             
├── profiles/                 
└── visits/                    
src/                           // Backend (Node + Express + Mongoose)
├── index.js                   
├── config/                    
├── models/                    
├── controllers/                
├── routes/                    
├── schemas/                   
├── middleware/                
└── services/                  
frontend/marketplace/          // Marketplace (Javascript + CSS + HTML)
├── pages/                     
├── scripts/                   
├── stylesheets/
└── assets/
frontend-navigator/            // Navigator SPA (React + Vite) 
├── src/                       
├── vite.config.js             
└── dist/                      
scripts/
├── seed.js                    
└── load-museum.js             

  
## Tecnologie utilizzate

#### Pacchetti NPM

- bcryptjs: per gestire l'hashing delle password
- cors: per abilitare le richieste cross-origin
- dotenv: per caricare le variabili d'ambiente
- Express: per creare la API REST
- i18next: per la gestione delle traduzioni
- jsonwebtoken: per fornire stateless authentication
- MongoDB + Mongoose: per gestire il database
- multer: per gestire l'upload dei file
- Socket.io: per sincronizzare le visite su più dispositivi
- Zod: per validare il body delle richieste

#### Pacchetti NPM di sviluppo

- vite: per il build system e il server di sviluppo del navigator

#### Server-side
Javascript

#### Applicazione marketplace
Javascript

#### Applicazione navigator
React

## Contributo individuale
#### Matteo Mazzetti: Sviluppo della logica di esecuzione della visita sincronizzata, gestione dell'inserimento delle domande e trasmissione dei dati in tempo reale all'host. Sviluppo della griglia di navigazione dei musei, delle pagine relative ad account, login, register, about e della visits list. Implementazione dell'opzione multilingua.
#### Federico Serra: Sviluppo del backend, degli script di test per l'API e per l'ambiente di sviluppo locale. Creazione delle pagine principali del Navigator. Popolamento del database con i dati necessari per le visite e i musei.
#### Andrea Ziccone: Sviluppo della grafica del sito (marketplace e navigator) e della struttura generale del marketplace, con homepage per la scelta del museo e flusso di selezione/creazione della visita. Sviluppo (HTML, CSS, JS) delle pagine homepage, create_items, create_visits e my_items.
#### LLM: Supporto nella coerenza dello stile del sito. Aiuto nell'implementazione dell'opzione multilingua(it-en) del sito. Supporto nella strutturazione del backend per creare una REST API. Risoluzione di errori e problemi vari, ad esempio legati all'ambiente di sviluppo.

