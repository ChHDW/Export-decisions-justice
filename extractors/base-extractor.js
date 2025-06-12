// Classe de base pour tous les extracteurs de contenu juridique
window.BaseExtractor = class {
    
    constructor(siteName) {
        this.siteName = siteName;
        this.isCompatible = false;
    }

    // Méthodes à implémenter dans les classes filles
    
    // Vérifier si on est sur une page compatible
    checkCompatibility() {
        throw new Error("checkCompatibility() doit être implémentée");
    }

    // Extraire les métadonnées de base
    extractMetadata() {
        throw new Error("extractMetadata() doit être implémentée");
    }

    // Extraire le texte de la décision
    extractDecisionText() {
        throw new Error("extractDecisionText() doit être implémentée");
    }

    // Extraire l'analyse/résumé
    extractAnalysis() {
        throw new Error("extractAnalysis() doit être implémentée");
    }

    // Méthodes communes disponibles pour toutes les classes filles

    // Formater le texte de décision avec mise en forme améliorée
    formatDecisionText(rawText) {
        if (!rawText) return null;

        let text = rawText;
        
        // Améliorer la structure du texte
        text = text.replace(/;\s*\n/g, ";\n\n"); // Sauts après points-virgules
        text = text.replace(/:\s*\n/g, ":\n\n"); // Sauts après deux-points
        text = text.replace(/Considérant/g, "\n\nConsidérant"); // Séparer les considérants
        text = text.replace(/Article \d+/g, "\n\n$&"); // Séparer les articles
        text = text.replace(/DECIDE|DÉCIDE/g, "\n\n$&"); // Séparer les décisions
        text = text.replace(/PAR CES MOTIFS/g, "\n\n$&"); // Séparer les motifs
        
        return window.DOMHelpers.cleanText(text);
    }

    // Extraire la date au format standardisé
    parseDate(dateText) {
        if (!dateText) return null;
        
        // Expressions régulières pour différents formats de date
        const patterns = [
            /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            /(\d{4})-(\d{1,2})-(\d{1,2})/
        ];
        
        for (const pattern of patterns) {
            const match = dateText.match(pattern);
            if (match) {
                return {
                    original: match[0],
                    formatted: match[0], // Peut être personnalisé selon le besoin
                    year: this._extractYear(match)
                };
            }
        }
        
        return null;
    }

    // Extraire l'année d'une correspondance de date
    _extractYear(match) {
        // Chercher un groupe de 4 chiffres dans la correspondance
        for (let i = 1; i < match.length; i++) {
            if (match[i] && match[i].length === 4 && /^\d{4}$/.test(match[i])) {
                return match[i];
            }
        }
        return null;
    }

    // Nettoyer un numéro d'arrêt
    cleanDecisionNumber(numberText) {
        if (!numberText) return null;
        
        return numberText
            .replace(/^N°?\s*/, "") // Supprimer "N°" au début
            .replace(/\s+/g, " ") // Normaliser les espaces
            .trim();
    }

    // Générer l'URL actuelle
    getCurrentUrl() {
        return window.location.href;
    }

    // Méthodes publiques utilisées par l'interface

    // Générer un RIS de base
    generateBasicRIS() {
        const metadata = this.extractMetadata();
        if (!metadata) return null;
        
        // Utiliser le générateur spécialisé pour Curia s'il existe
        if (this.siteName === "Curia" && window.RISGenerator.generateCuriaRIS) {
            return window.RISGenerator.generateCuriaRIS(metadata);
        }
        
        // Pour Légifrance et autres sites : titre vide
        const options = {
            fillTitle: this.siteName !== "Légifrance" // false pour Légifrance, true pour autres
        };
        
        return window.RISGenerator.generateBasic(metadata, options);
    }

    // Générer un RIS complet
    async generateCompleteRIS() {
        const metadata = this.extractMetadata();
        let decisionText = null;
        let analysisText = null;
        let opinionText = null;
        
        try {
            // Gérer les extracteurs asynchrones (comme Curia) et synchrones (comme Légifrance)
            const decisionResult = this.extractDecisionText();
            if (decisionResult && typeof decisionResult.then === 'function') {
                // Méthode asynchrone
                decisionText = await decisionResult;
            } else {
                // Méthode synchrone
                decisionText = decisionResult;
            }

            const analysisResult = this.extractAnalysis();
            if (analysisResult && typeof analysisResult.then === 'function') {
                // Méthode asynchrone
                analysisText = await analysisResult;
            } else {
                // Méthode synchrone
                analysisText = analysisResult;
            }

            // Pour Curia : extraire les conclusions si on est sur une page de liste
            if (this.siteName === "Curia" && window.location.href.includes("/liste.jsf")) {
                try {
                    if (typeof this._fetchAndExtractOpinions === 'function') {
                        opinionText = await this._fetchAndExtractOpinions();
                    }
                } catch (error) {
                    this.log("Erreur lors de l'extraction des conclusions", error);
                    // Continuer même si les conclusions ne sont pas disponibles
                }
            }
        } catch (error) {
            this.log("Erreur lors de l'extraction du contenu pour RIS complet", error);
        }
        
        if (!metadata) return null;
        
        const content = {
            decisionText: this.formatDecisionText(decisionText),
            analysisText,
            opinionText // Ajouter les conclusions pour Curia
        };
        
        // Options selon le site
        const options = {
            fillTitle: this.siteName !== "Légifrance" // false pour Légifrance
        };
        
        // Pour Curia, utiliser une génération spécialisée qui inclut les conclusions
        if (this.siteName === "Curia") {
            return this._generateCuriaCompleteRIS(metadata, content);
        }
        
        return window.RISGenerator.generateComplete(metadata, content, options);
    }

    // Générer un RIS complet spécialisé pour Curia (avec conclusions et URLs)
    _generateCuriaCompleteRIS(metadata, content) {
        let ris = "";
        ris += "TY  - CASE\n";
        
        // Titre - toujours rempli pour Curia
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
        
        // Ajouter le texte de la décision AVEC URL
        if (content.decisionText) {
            ris += `N1  - TEXTE DE LA DECISION:\n`;
            
            // Ajouter l'URL de la décision (EUR-Lex prioritaire, sinon Curia)
            if (metadata.url) {
                ris += `${metadata.url}\n`;
            } else if (metadata.originalCuriaUrl) {
                ris += `${metadata.originalCuriaUrl}\n`;
            }
            
            ris += `${content.decisionText}\n`;
        }
        
        // Ajouter l'analyse si disponible (sans URL)
        if (content.analysisText) {
            ris += `N1  - ANALYSE:\n${content.analysisText}\n`;
        }
        
        // Ajouter les conclusions si disponibles AVEC URL
        if (content.opinionText) {
            ris += `N1  - CONCLUSIONS DE L'AVOCAT GENERAL:\n`;
            
            // Pour les conclusions, on utilise l'URL Curia originale ou on construit l'URL des conclusions
            if (metadata.originalCuriaUrl) {
                // URL de base vers les conclusions
                ris += `${metadata.originalCuriaUrl}\n`;
            } else if (metadata.url && metadata.url.includes('eur-lex')) {
                // Si on n'a que EUR-Lex, on peut essayer de construire l'URL CELEX des conclusions
                const conclusionsUrl = this._constructConclusionsEurLexUrl(metadata);
                if (conclusionsUrl) {
                    ris += `${conclusionsUrl}\n`;
                }
            }
            
            ris += `${content.opinionText}\n`;
        }
        
        // URL principale
        if (metadata.url) {
            ris += `UR  - ${metadata.url}\n`;
        }
        
        ris += "ER  - \n";
        
        return ris;
    }

    // Construire URL EUR-Lex pour les conclusions
    _constructConclusionsEurLexUrl(metadata) {
        if (!metadata.url || !metadata.url.includes('eur-lex') || !metadata.caseNumber) {
            return null;
        }
        
        try {
            // Extraire l'identifiant CELEX depuis l'URL existante
            // Exemple: https://eur-lex.europa.eu/legal-content/fr/TXT/?uri=CELEX:62022CJ0278
            const celexMatch = metadata.url.match(/CELEX:(\d{5})([A-Z]{2})(\d{4})/);
            if (!celexMatch) return null;
            
            const [, yearCode, docType, number] = celexMatch;
            
            // Convertir le type de document d'arrêt vers conclusions
            // CJ (Cour) -> CC (Conclusions Cour), TJ (Tribunal) -> TC (Conclusions Tribunal)
            let conclusionsDocType;
            if (docType === 'CJ') {
                conclusionsDocType = 'CC';
            } else if (docType === 'TJ') {
                conclusionsDocType = 'TC';
            } else {
                return null; // Type non supporté
            }
            
            // Construire l'identifiant CELEX des conclusions
            const conclusionsCelex = `${yearCode}${conclusionsDocType}${number}`;
            
            // Construire l'URL finale
            return `https://eur-lex.europa.eu/legal-content/fr/TXT/?uri=CELEX:${conclusionsCelex}`;
            
        } catch (error) {
            this.log("Erreur construction URL conclusions EUR-Lex", error);
            return null;
        }
    }

    // Vérifier que toutes les données essentielles sont présentes
    validateExtraction() {
        const metadata = this.extractMetadata();
        return window.RISGenerator.validateMetadata(metadata);
    }

    // Log de débogage spécifique au site
    log(message, data = null) {
        console.log(`[${this.siteName}] ${message}`, data || "");
    }
};