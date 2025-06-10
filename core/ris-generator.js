// Générateur de fichiers RIS
window.RISGenerator = {
    
    // Générer un RIS de base avec métadonnées seulement
    generateBasic(metadata) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre (vide par défaut pour saisie manuelle)
        ris += "TI  - \n";
        
        // Auteur (vide par défaut)
        ris += "AU  - \n";
        
        // Juridiction
        if (metadata.court) {
            ris += `PB  - ${metadata.court}\n`;
        }
        
        // Date
        if (metadata.date) {
            ris += `DA  - ${metadata.date}\n`;
        }
        
        // Année
        if (metadata.year) {
            ris += `PY  - ${metadata.year}\n`;
        }
        
        // Numéro de l'arrêt
        if (metadata.number) {
            ris += `A2  - ${metadata.number}\n`;
        }
        
        // URL
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
        ris += "ER  - \n";
        
        return ris;
    },

    // Générer un RIS complet avec contenu
    generateComplete(metadata, content = {}) {
        let ris = this.generateBasic(metadata);
        
        // Retirer la ligne de fin pour ajouter du contenu
        ris = ris.replace("ER  - \n", "");
        
        // Ajouter le texte de la décision
        if (content.decisionText) {
            ris += `N1  - TEXTE DE LA DECISION:\n${content.decisionText}\n`;
        }
        
        // Ajouter l'analyse
        if (content.analysisText) {
            ris += `N1  - ANALYSE:\n${content.analysisText}\n`;
        }
        
        // Ajouter d'autres contenus si présents
        if (content.additionalNotes) {
            content.additionalNotes.forEach(note => {
                ris += `N1  - ${note}\n`;
            });
        }
        
        // Remettre la ligne de fin
        ris += "ER  - \n";
        
        return ris;
    },

    // Convertir les noms de juridictions en format standardisé
    standardizeCourtName(courtName, site = "legifrance") {
        if (!courtName) return "";
        
        const court = courtName.toLowerCase();
        
        // Conversions communes à tous les sites
        if (court.includes("conseil d'etat") || court.includes("conseil d'état")) {
            return "CE";
        }
        
        if (court.includes("cour de cassation")) {
            return "Cass.";
        }
        
        if (court.includes("cour d'appel")) {
            const cityMatch = courtName.match(/cour d'appel.*?de\s+([A-Za-zÀ-ÿ\s-]+)/i);
            if (cityMatch) {
                return `CA ${cityMatch[1].trim()}`;
            }
            return "CA";
        }
        
        if (court.includes("cour administrative d'appel")) {
            const cityMatch = courtName.match(/cour administrative d'appel.*?de\s+([A-Za-zÀ-ÿ\s-]+)/i);
            if (cityMatch) {
                return `CAA ${cityMatch[1].trim()}`;
            }
            return "CAA";
        }
        
        if (court.includes("tribunal administratif")) {
            const cityMatch = courtName.match(/tribunal administratif.*?de\s+([A-Za-zÀ-ÿ\s-]+)/i);
            if (cityMatch) {
                return `TA ${cityMatch[1].trim()}`;
            }
            return "TA";
        }
        
        // Conversions spécifiques selon le site
        if (site === "curia") {
            // Ajouts futurs pour Curia
        }
        
        // Si aucun pattern reconnu, retourner le nom original
        return courtName;
    },

    // Valider les métadonnées
    validateMetadata(metadata) {
        const required = ["court", "date", "number"];
        const missing = required.filter(field => !metadata[field]);
        
        return {
            isValid: missing.length === 0,
            missingFields: missing
        };
    },

    // Créer un blob RIS pour téléchargement ou import
    createBlob(risContent) {
        return new Blob([risContent], { 
            type: "application/x-research-info-systems" 
        });
    }
};