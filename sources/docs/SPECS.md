# Project Specifications: ArtAround

## 1. Main Goal & Philosophy
* **Core Concept:** Develop a generic software suite for cultural heritage (museums/galleries) that enables personalized, user-centric visits.
* **Goal-Oriented Design:** The application must adapt to the user rather than forcing the user to adapt to the system.
* **Adaptability:** The content presentation must adjust based on four user dimensions without creating separate applications:
    * **Specific interests** (e.g., history, technique, materials).
    * **Background competence** (e.g., casual, expert, curious).
    * **Visit context** (e.g., time available, first visit vs. regular).
    * **Age and maturity** (e.g., students, pensioners, children).

## 2. System Architecture & Components
The system consists of two main applications communicating with a server.

### A. ArtAround Editor - Marketplace (Pre-visit)
* **Platform:** Designed for PC (client-side).
* **Functionality:**
    * **Museum Selection:** Select a museum via a multiple-choice panel.
    * **Content Creation:** Create items with unique IDs, images, and metadata.
    * **Content Management:** Handle scale (hundreds/thousands of items) and organize content sequences.
    * **Commercial:** Publish content with licensing and pricing, manage sales and adoption.

### B. ArtAround Navigator (During visit)
* **Platform:** Designed for Smartphone (client-side).
* **Functionality:**
    * **Generic Design:** Configuration-based adaptation for specific museums.
    * **Navigation:** 2D/3D visualization of environments, identifying POIs (entrances, exits, toilets, obstacles).
    * **Presentation:** Text-to-Speech (TTS) and screen visualization of items.
    * **Interaction:** Voice commands and accessible button equivalents.

## 3. Data Model
* **Visits:** A sequence of item descriptions and logistical directions (e.g., "go left"). Logistical directions are distinct from "items".
* **Items:** Text intended for synthesis/display, characterized by specific metadata:
    * **Duration:** e.g., 3s, 15s, 1min, 4min.
    * **Language/Tone:** e.g., infantile, elementary, medium, specialist.
    * **Attributes:** Author, license, and associated topics (styles, history, artists).
* **Multiplicity:** A visit should contain multiple items for the same object to facilitate adaptability.

## 4. Technical Hard Constraints
### Server-Side
* **Required Stack:** Node.js, MongoDB, vanilla Javascript/TypeScript, Express, npm modules.
* **Forbidden:** PHP, Python, Java, Ruby, MySQL, Deno, or other server-side technologies.
* **Hosting:** Deploy on two Docker containers on department servers.

### Client-Side (Navigator)
* **Required Stack:** Javascript or TypeScript with a framework (Angular, React, Vue, Svelte, etc.).

### Client-Side (Marketplace)
* **Required Stack:** Vanilla Javascript/TypeScript.
* **Allowed:** Web Components, Alpine, or HTMX.
* **Forbidden:** Frameworks (React, Angular, etc.).

### Data Population
* Databases must be pre-filled with real museum data (e.g., Pinacoteca, Mambo).
* **Required Accounts:** "autore1", "autore2", "visitatore1", "visitatore2" (Password: "12345678").
* **Required Content:** At least 3 visits with 10 works each.

## 5. Project Tiers and Extensions

### Base Level (Score 18-24)
* **Features:**
    * Marketplace access and visit execution.
    * Map visualization without user positioning.
    * TTS and screen display.
    * **Voice Control:** Controlled vocabulary (Next, Previous, Tell me more, Simpler, Where is the exit).

### Extension 1: Synchronization (Score 18-27)
* **Target:** Teachers or guides controlling a group visit.
* **Features:**
    * **Teacher Control:** Teacher triggers descriptions; students cannot skip ahead or back.
    * **Engagement:** Teacher monitors student engagement and questions.
    * **Customization:** Teacher creates a synchronized visit with a mnemonic name (e.g., "Red Phoenix").
    * **Assessment:** End-of-visit quiz and grading.

### Extension 2: Georeferencing & AI (Score 18-33)
* **Geolocation:**
    * **Base:** QR Code scanning to identify objects.
    * **Advanced:** Device georeferencing and orientation with image recognition fallback.
    * **Navigation:** Directs users to the next object or relevant facilities/obstacles.
* **Generative AI (LLM) Integration:**
    * **Content Generation:** Create items/descriptions not in the DB.
    * **NLP:** Process natural language voice commands into system commands (e.g., "And now?" -> "Next").
    * **Translation:** Real-time translation of content and commands.
    * **Dynamic Visits:** Create custom visits based on constraints (e.g., "I have 30 mins", "Explain to a 5-year-old").
    * **Constraint:** User must not know they are interacting with an LLM (no prompts shown).

## 6. Documentation
* A `README.txt` file is mandatory and must match the version uploaded to the virtual portal.
* It must detail group members, architecture, AI contributions, and specific features implemented.