// Générateur de fichiers RIS mis à jour pour CJUE
window.RISGenerator = {

    // Générer un RIS de base avec métadonnées seulement
    generateBasic(metadata) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre - utiliser le nom de l'affaire ou un titre par défaut
        if (metadata.caseName) {
            ris += `TI  - ${metadata.caseName}\n`;
        } else if (metadata.fullTitle) {
            // Extraire un titre court du titre complet
            const shortTitle = this.extractShortTitle(metadata.fullTitle);
            ris += `TI  - ${shortTitle}\n`;
        } else {
            ris += "TI  - \n";
        }
        
        // Auteur (vide par défaut pour saisie manuelle)
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
        } else if (metadata.caseNumber) {
            ris += `A2  - aff. ${metadata.caseNumber}\n`;
        }
        
        // URL
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
        ris += "ER  - \n";
        
        return ris;
    },

    // Extraire un titre court depuis le titre complet
    extractShortTitle(fullTitle) {
        // Pour les arrêts CJUE, extraire les parties principales
        const partiesMatch = fullTitle.match(/([^.]+?)\s+contre\s+([^.]+)/);
        if (partiesMatch) {
            return `${partiesMatch[1].trim()} c. ${partiesMatch[2].trim()}`;
        }
        
        // Fallback : prendre les premiers mots
        const words = fullTitle.split(' ');
        if (words.length > 10) {
            return words.slice(0, 10).join(' ') + '...';
        }
        
        return fullTitle;
    },

    // Générer un RIS complet avec contenu
    generateComplete(metadata, content = {}) {
        let ris = this.generateBasic(metadata);
        
        // Retirer la ligne de fin pour ajouter du contenu
        ris = ris.replace("ER  - \n", "");
        
        // Ajouter le texte de la décision
        if (content.decisionText) {
            // Limiter la taille pour éviter les problèmes de mémoire
            const limitedText = this.limitTextLength(content.decisionText, 50000);
            ris += `N1  - TEXTE DE LA DECISION:\n${limitedText}\n\n`;
        }
        
        // Ajouter l'analyse
        if (content.analysisText) {
            const limitedAnalysis = this.limitTextLength(content.analysisText, 10000);
            ris += `N1  - ANALYSE:\n${limitedAnalysis}\n\n`;
        }
        
        // Remettre la ligne de fin
        ris += "ER  - \n";
        
        return ris;
    },

    // Limiter la longueur du texte pour éviter les problèmes
    limitTextLength(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        
        // Couper au dernier espace avant la limite pour éviter de couper au milieu d'un mot
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.8) { // Si l'espace est assez proche de la fin
            return truncated.substring(0, lastSpace) + "\n\n[TEXTE TRONQUÉ - LIMITE DE TAILLE ATTEINTE]";
        }
        
        return truncated + "\n\n[TEXTE TRONQUÉ - LIMITE DE TAILLE ATTEINTE]";
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
        
        // Conversions spécifiques pour les juridictions européennes
        if (site === "curia" || site === "eur-lex") {
            if (court.includes("cjue") || court.includes("cour de justice")) {
                return "CJUE";
            }
            if (court.includes("tribunal") && court.includes("ue")) {
                return "Trib. UE";
            }
            if (court.includes("tribunal") && court.includes("fonction")) {
                return "Trib. fonction publique UE";
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
    },

    // Générer un RIS spécifique pour Curia/EUR-Lex
    generateCuriaRIS(metadata) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre de l'affaire
        if (metadata.caseName) {
            ris += `TI  - ${metadata.caseName}\n`;
        } else {
            ris += "TI  - \n";
        }
        
        // Auteur (vide par défaut)
        ris += "AU  - \n";
        
        // Juridiction européenne
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
        
        // Numéro d'affaire
        if (metadata.caseNumber) {
            ris += `A2  - aff. ${metadata.caseNumber}\n`;
        }
        
        // ECLI comme identifiant
        if (metadata.ecli) {
            ris += `M1  - ${metadata.ecli}\n`;
        }
        
        // URL
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
        ris += "ER  - \n";
        
        return ris;
    }
};