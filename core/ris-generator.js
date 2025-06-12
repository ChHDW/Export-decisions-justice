// Générateur de fichiers RIS - Version complète avec URLs
window.RISGenerator = {

    // Générer un RIS de base avec métadonnées seulement
    generateBasic(metadata, options = {}) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre - comportement différent selon le site
        if (options.fillTitle === false || metadata.site === "Légifrance") {
            // Pour Légifrance : titre toujours vide
            ris += "TI  - \n";
        } else if (metadata.caseName) {
            ris += `TI  - ${metadata.caseName}\n`;
        } else if (metadata.fullTitle) {
            ris += `TI  - ${metadata.fullTitle}\n`;
        } else if (metadata.title) {
            ris += `TI  - ${metadata.title}\n`;
        } else {
            ris += "TI  - \n"; // Vide pour saisie manuelle
        }
        
        // Auteur (vide par défaut)
        ris += "AU  - \n";
        
        // Juridiction
        if (metadata.court) {
            ris += `PB  - ${metadata.court}\n`;
        }
        
        // Date - utiliser dateRIS si disponible, sinon date normale
        if (metadata.dateRIS) {
            ris += `DA  - ${metadata.dateRIS}\n`;
        } else if (metadata.date) {
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
        
        // ECLI si disponible
        if (metadata.ecli) {
            ris += `M1  - ${metadata.ecli}\n`;
        }
        
        // URL
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
        ris += "ER  - \n";
        
        return ris;
    },

    // Générer un RIS complet avec contenu et URLs
    generateComplete(metadata, content = {}, options = {}) {
        let ris = this.generateBasic(metadata, options);
        
        // Retirer la ligne de fin pour ajouter du contenu
        ris = ris.replace("ER  - \n", "");
        
        // Ajouter le texte de la décision AVEC URL
        if (content.decisionText) {
            ris += `N1  - TEXTE DE LA DECISION:\n`;
            
            // Ajouter l'URL de la décision si disponible
            if (metadata.url) {
                ris += `${metadata.url}\n`;
            }
            
            ris += `${content.decisionText}\n`;
        }
        
        // Ajouter l'analyse (sans URL pour l'analyse)
        if (content.analysisText) {
            ris += `N1  - ANALYSE:\n${content.analysisText}\n`;
        }
        
        // Ajouter d'autres contenus si présents
        /*if (content.additionalNotes) {
            content.additionalNotes.forEach(note => {
                ris += `N1  - ${note}\n`;
            });
        }*/
        
        // Remettre la ligne de fin
        ris += "ER  - \n";
        
        return ris;
    },

    // Générer un RIS spécialisé pour Curia (avec titre toujours rempli)
    generateCuriaRIS(metadata) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre - priorité à caseName pour Curia (toujours rempli)
        if (metadata.caseName) {
            ris += `TI  - ${metadata.caseName}\n`;
        } else if (metadata.decisionTitle) {
            ris += `TI  - ${metadata.decisionTitle}\n`;
        } else if (metadata.fullTitle) {
            // Extraire juste le nom du cas depuis fullTitle
            const titleParts = metadata.fullTitle.split(" - ");
            if (titleParts.length >= 2) {
                ris += `TI  - ${titleParts[1].trim()}\n`;
            } else {
                ris += `TI  - ${metadata.fullTitle}\n`;
            }
        } else {
            ris += "TI  - \n";
        }
        
        // Auteur (vide par défaut)
        ris += "AU  - \n";
        
        // Juridiction
        if (metadata.court) {
            ris += `PB  - ${metadata.court}\n`;
        }
        
        // Date au format RIS
        if (metadata.dateRIS) {
            ris += `DA  - ${metadata.dateRIS}\n`;
        } else if (metadata.date) {
            ris += `DA  - ${metadata.date}\n`;
        }
        
        // Année
        if (metadata.year) {
            ris += `PY  - ${metadata.year}\n`;
        }
        
        // Numéro d'affaire
        if (metadata.number) {
            ris += `A2  - ${metadata.number}\n`;
        }
        
        // ECLI
        if (metadata.ecli) {
            ris += `M1  - ${metadata.ecli}\n`;
        }
        
        // Type de document si disponible
        if (metadata.documentType) {
            ris += `N1  - Type: ${metadata.documentType}\n`;
        }
        
        // URL
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
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
        
        // Conversions spécifiques pour Curia
        if (site === "curia" || site === "Curia") {
            if (court.includes("cjue") || court.includes("cour de justice")) {
                return "CJUE";
            }
            if (court.includes("tribunal") && court.includes("ue")) {
                return "Trib. UE";
            }
        }
        
        // Si aucun pattern reconnu, retourner le nom original
        return courtName;
    },

    // Valider les métadonnées
    validateMetadata(metadata) {
        const required = ["court", "date"];
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