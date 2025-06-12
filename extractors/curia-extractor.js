// Extracteur spécifique pour Curia (CJUE) - Version corrigée
window.CuriaExtractor = class extends window.BaseExtractor {
    
    constructor() {
        super("Curia");
        this.isCompatible = this.checkCompatibility();
    }

    // Vérifier si on est sur une page Curia compatible
    checkCompatibility() {
        const url = window.location.href;
        const isCuria = url.includes("curia.europa.eu");
        const isListePage = url.includes("/liste.jsf") || url.includes("/document/document.jsf");
        
        // Vérifier qu'on a au moins une affaire affichée
        const hasCase = document.querySelector(".affaire_title") !== null ||
                       document.querySelector(".outputEcliAff") !== null;
        
        const compatible = isCuria && (isListePage && hasCase);
        this.log("Vérification de compatibilité", { url, compatible, hasCase });
        
        return compatible;
    }

    // Extraire les métadonnées spécifiques à Curia
    extractMetadata() {
        const metadata = {
            site: this.siteName,
            url: this.getCurrentUrl()
        };
        
        try {
            // Extraire le titre de l'affaire (numéro + nom du requérant)
            const affaireTitleElement = document.querySelector(".affaire_title");
            if (affaireTitleElement) {
                const fullTitle = affaireTitleElement.textContent.trim();
                // Format attendu: "C-278/22 - AUTOTECHNICA FLEET SERVICES"
                const titleParts = fullTitle.split(" - ");
                
                if (titleParts.length >= 2) {
                    metadata.caseNumber = titleParts[0].trim(); // "C-278/22"
                    metadata.caseName = titleParts[1].trim(); // "AUTOTECHNICA FLEET SERVICES"
                    metadata.fullTitle = fullTitle;
                }
            }

            // Extraire les informations de la décision
            const decisionTitleElement = document.querySelector(".decision_title");
            if (decisionTitleElement) {
                const decisionText = decisionTitleElement.textContent.trim();
                
                // Extraire le type de document (Arrêt, Conclusions, etc.)
                const docTypeMatch = decisionText.match(/^(Arrêt|Conclusions|Ordonnance)/);
                if (docTypeMatch) {
                    metadata.documentType = docTypeMatch[1];
                }
                
                // Extraire la date (format: "21/12/2023")
                const dateMatch = decisionText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                if (dateMatch) {
                    const dateParts = dateMatch[1].split("/");
                    metadata.date = dateMatch[1];
                    metadata.year = dateParts[2];
                    // Convertir au format RIS (YYYY/MM/DD)
                    metadata.dateRIS = `${dateParts[2]}/${dateParts[1].padStart(2, '0')}/${dateParts[0].padStart(2, '0')}`;
                }

                // 🚀 NOUVELLE FONCTIONNALITÉ : Extraire le titre depuis decision_title
                // Pattern: "[Type] - [Date] - [Titre]"
                const titleAfterDateMatch = decisionText.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*(.+)$/);
                if (titleAfterDateMatch) {
                    const decisionTitle = titleAfterDateMatch[1].trim();
                    metadata.decisionTitle = decisionTitle;
                    
                    // Si on n'a pas encore de caseName, utiliser le titre de la décision
                    if (!metadata.caseName && decisionTitle) {
                        metadata.caseName = decisionTitle;
                    }
                }
            }

            // Extraire l'ECLI
            const ecliElement = document.querySelector(".outputEcliAff");
            if (ecliElement) {
                metadata.ecli = ecliElement.textContent.trim();
            }

            // Déterminer la juridiction à partir du numéro d'affaire
            if (metadata.caseNumber) {
                metadata.court = this.determineCourtFromCaseNumber(metadata.caseNumber);
                metadata.number = `aff. ${metadata.caseNumber}`;
            }

            // 🌟 NOUVELLE FONCTIONNALITÉ : Extraire l'URL EUR-Lex
            metadata.eurLexUrl = this.extractEurLexUrl(metadata.documentType);
            
            // Utiliser l'URL EUR-Lex comme URL principale si disponible
            if (metadata.eurLexUrl) {
                metadata.url = metadata.eurLexUrl;
                metadata.originalCuriaUrl = this.getCurrentUrl();
            }

            // Extraire les liens vers les documents
            metadata.documentLinks = this.extractDocumentLinks();

            this.log("Métadonnées extraites", metadata);
            return metadata;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des métadonnées", error);
            return null;
        }
    }

    // Déterminer la juridiction à partir du numéro d'affaire
    determineCourtFromCaseNumber(caseNumber) {
        if (caseNumber.startsWith("C-")) {
            return "CJUE";
        } else if (caseNumber.startsWith("T-")) {
            return "Trib. UE";
        } else if (caseNumber.startsWith("F-")) {
            return "Trib. fonction publique UE";
        }
        return "Cour UE"; // Fallback générique
    }

    // Extraire les liens vers les documents (pour usage futur)
    extractDocumentLinks() {
        const links = {
            judgment: null,
            opinion: null,
            documents: []
        };

        try {
            // Chercher tous les liens vers les documents
            const documentLinks = document.querySelectorAll("a[href*='document/document.jsf']");
            
            documentLinks.forEach(link => {
                const href = link.getAttribute("href");
                const row = link.closest("tr");
                
                if (row) {
                    const cellText = row.querySelector(".liste_table_cell_doc");
                    if (cellText) {
                        const text = cellText.textContent.trim();
                        const absoluteUrl = this.makeAbsoluteUrl(href);
                        
                        // Categoriser les documents
                        if (text.includes("Arrêt")) {
                            links.judgment = absoluteUrl;
                        } else if (text.includes("Conclusions")) {
                            links.opinion = absoluteUrl;
                        }
                        
                        // Ajouter à la liste générale
                        links.documents.push({
                            type: text.split('\n')[0], // Premier ligne = type
                            url: absoluteUrl,
                            ecli: cellText.querySelector('.outputEcliAff')?.textContent?.trim() || null
                        });
                    }
                }
            });
        } catch (error) {
            this.log("Erreur lors de l'extraction des liens", error);
        }

        return links;
    }

    // 🌟 NOUVELLE MÉTHODE : Extraire l'URL EUR-Lex selon le type de document
    extractEurLexUrl(documentType = "Arrêt") {
        try {
            // Chercher le bon lien EUR-Lex selon le type de document affiché
            const currentDecisionRow = this.getCurrentDecisionRow();
            if (!currentDecisionRow) {
                this.log("Ligne de décision actuelle non trouvée");
                return null;
            }

            // Chercher le lien EUR-Lex dans la ligne actuelle
            const eurLexLink = currentDecisionRow.querySelector("a[href*='eur-lex.europa.eu']");
            if (eurLexLink) {
                const url = eurLexLink.getAttribute("href");
                this.log("URL EUR-Lex extraite", url);
                return url;
            }

            // Fallback : construire l'URL à partir de l'ECLI ou du numéro d'affaire
            return this.constructEurLexUrl(documentType);

        } catch (error) {
            this.log("Erreur lors de l'extraction de l'URL EUR-Lex", error);
            return null;
        }
    }

    // Trouver la ligne de décision correspondant au type de document affiché
    getCurrentDecisionRow() {
        // Chercher la ligne qui contient le type de document dans decision_title
        const decisionTitleElement = document.querySelector(".decision_title");
        if (!decisionTitleElement) return null;

        const decisionText = decisionTitleElement.textContent.trim();
        const docTypeMatch = decisionText.match(/^(Arrêt|Conclusions|Ordonnance)/);
        
        if (!docTypeMatch) return null;
        
        const currentDocType = docTypeMatch[1];
        
        // Chercher dans le tableau des documents
        const documentRows = document.querySelectorAll(".table_document_ligne");
        
        for (const row of documentRows) {
            const cellDoc = row.querySelector(".liste_table_cell_doc");
            if (cellDoc && cellDoc.textContent.includes(currentDocType)) {
                return row;
            }
        }
        
        // Fallback : prendre la première ligne si pas de correspondance exacte
        return documentRows[0] || null;
    }

    // Construire l'URL EUR-Lex à partir du numéro d'affaire (fallback)
    constructEurLexUrl(documentType = "Arrêt") {
        try {
            const metadata = this.extractBasicCaseInfo();
            if (!metadata.caseNumber || !metadata.year) {
                return null;
            }

            // Extraire les parties du numéro d'affaire
            // Exemple: "C-278/22" -> court="C", number="278", year="22"
            const caseMatch = metadata.caseNumber.match(/([CTF])-(\d+)\/(\d+)/);
            if (!caseMatch) return null;

            const [, court, number, shortYear] = caseMatch;
            
            // Convertir l'année courte en année complète
            const fullYear = shortYear.length === 2 ? `20${shortYear}` : shortYear;
            
            // Déterminer le type de document pour CELEX
            let docTypeCode;
            if (documentType === "Arrêt") {
                docTypeCode = court === "C" ? "CJ" : (court === "T" ? "TJ" : "FJ");
            } else if (documentType === "Conclusions") {
                docTypeCode = court === "C" ? "CC" : (court === "T" ? "TC" : "FC");
            } else {
                docTypeCode = court === "C" ? "CJ" : (court === "T" ? "TJ" : "FJ"); // Default à arrêt
            }
            
            // Construire l'identifiant CELEX
            // Format: 6[YYYY][TYPE][NNNN] (exemple: 62022CJ0278)
            const celexId = `6${fullYear}${docTypeCode}${number.padStart(4, '0')}`;
            
            // Construire l'URL EUR-Lex
            const eurLexUrl = `https://eur-lex.europa.eu/legal-content/fr/TXT/?uri=CELEX:${celexId}`;
            
            this.log("URL EUR-Lex construite", { celexId, eurLexUrl });
            return eurLexUrl;

        } catch (error) {
            this.log("Erreur lors de la construction de l'URL EUR-Lex", error);
            return null;
        }
    }

    // Extraire les informations de base de l'affaire (méthode utilitaire)
    extractBasicCaseInfo() {
        const info = {};
        
        // Numéro d'affaire
        const affaireTitleElement = document.querySelector(".affaire_title");
        if (affaireTitleElement) {
            const titleParts = affaireTitleElement.textContent.trim().split(" - ");
            if (titleParts.length >= 1) {
                info.caseNumber = titleParts[0].trim();
            }
        }
        
        // Année depuis la date
        const decisionTitleElement = document.querySelector(".decision_title");
        if (decisionTitleElement) {
            const dateMatch = decisionTitleElement.textContent.match(/(\d{1,2}\/\d{1,2}\/(\d{4}))/);
            if (dateMatch) {
                info.year = dateMatch[2];
            }
        }
        
        return info;
    }

    // Convertir une URL relative en URL absolue
    makeAbsoluteUrl(relativeUrl) {
        if (relativeUrl.startsWith("http")) {
            return relativeUrl;
        }
        return new URL(relativeUrl, window.location.origin).href;
    }

    // Pour l'instant, retourner null car on est sur une page de liste
    // Plus tard, on pourra implémenter l'extraction en suivant les liens
    extractDecisionText() {
        this.log("Extraction du texte de décision non implémentée sur la page de liste");
        return null;
    }

    // Pour l'instant, retourner null car on est sur une page de liste
    extractAnalysis() {
        this.log("Extraction de l'analyse non implémentée sur la page de liste");
        return null;
    }

    // 🚀 NOUVELLE MÉTHODE : Générer un RIS spécialisé pour Curia
    generateBasicRIS() {
        const metadata = this.extractMetadata();
        if (!metadata) return null;
        
        return window.RISGenerator.generateCuriaRIS(metadata);
    }

    // Méthodes spécifiques à Curia

    // Identifier le type de juridiction européenne
    getJurisdictionType() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.caseNumber) return "europeen";
        
        if (metadata.caseNumber.startsWith("C-")) return "cjue";
        if (metadata.caseNumber.startsWith("T-")) return "tribunal_ue";
        if (metadata.caseNumber.startsWith("F-")) return "tribunal_fonction_publique";
        
        return "europeen";
    }

    // Extraire les numéros d'affaires jointes s'il y en a
    extractJoinedCases() {
        const metadata = this.extractMetadata();
        if (!metadata || !metadata.fullTitle) return [];
        
        // Chercher des patterns comme "C-278/22, C-279/22"
        const joinedPattern = /([CTF]-\d+\/\d+)/g;
        const matches = metadata.fullTitle.match(joinedPattern);
        
        return matches && matches.length > 1 ? matches : [];
    }

    // Valider que les données essentielles sont présentes pour Curia
    validateExtraction() {
        const metadata = this.extractMetadata();
        if (!metadata) {
            return {
                isValid: false,
                missingFields: ["metadata"]
            };
        }

        const required = ["caseNumber", "caseName", "date", "court"];
        const missing = required.filter(field => !metadata[field]);
        
        return {
            isValid: missing.length === 0,
            missingFields: missing
        };
    }

    // 🚀 MÉTHODE DE DEBUG : Afficher toutes les métadonnées extraites
    debugExtraction() {
        const metadata = this.extractMetadata();
        console.table(metadata);
        return metadata;
    }
};