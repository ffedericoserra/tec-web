// Semplice script per la gestione dei Tab (puoi spostarlo in un file JS separato)
      document.querySelectorAll(".tab-btn").forEach((button) => {
        button.addEventListener("click", () => {
          // Rimuove 'active' da tutti i bottoni e contenuti
          document
            .querySelectorAll(".tab-btn")
            .forEach((btn) => btn.classList.remove("active"));
          document.querySelectorAll(".tab-content").forEach((content) => {
            content.classList.remove("active");
            content.classList.add("hidden");
          });

          // Aggiunge 'active' al bottone cliccato e al rispettivo contenuto
          button.classList.add("active");
          const targetId = button.getAttribute("data-target");
          const targetContent = document.getElementById(targetId);
          if (targetContent) {
            targetContent.classList.remove("hidden");
            targetContent.classList.add("active");
          }
        });
      });