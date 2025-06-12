// Extracteur spécifique pour Curia (CJUE) - Version complète avec extraction automatique et URLs
window.CuriaExtractor = class extends window.BaseExtractor {
    
    constructor() {
        super("Curia");
        this.isCompatible = this.checkCompatibility();
    }

    // Vérifier si on est sur une page Curia compatible
    checkCompatibility() {
        const url = window.location.href;
        const isCuria = url.includes("curia.europa.eu");
        
        if (!isCuria) return false;
        
        // Vérifier le type de page et la compatibilité
        if (url.includes("/liste.jsf")) {
            // Page de liste : vérifier qu'on a une affaire affichée
            const hasCase = document.querySelector(".affaire_title") !== null ||
                           document.querySelector(".outputEcliAff") !== null;
            return hasCase;
        } else if (url.includes("/document/document.jsf")) {
            // Page de document : vérifier qu'on a le contenu du document
            const hasDocumentContent = document.querySelector("#document_content") !== null;
            return hasDocumentContent;
        }
        
        return false;
    }

    // Extraire les métadonnées spécifiques à Curia
    extractMetadata() {
        const metadata = {
            site: this.siteName,
            url: this.getCurrentUrl()
        };
        
        const url = window.location.href;
        
        try {
            if (url.includes("/liste.jsf")) {
                return this._extractMetadataFromListPage(metadata);
            } else if (url.includes("/document/document.jsf")) {
                return this._extractMetadataFromDocumentPage(metadata);
            }
            
            this.log("Type de page non reconnu pour l'extraction de métadonnées");
            return metadata;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des métadonnées", error);
            return null;
        }
    }

    // Extraire le texte de la décision
    async extractDecisionText() {
        const url = window.location.href;
        
        if (url.includes("/document/document.jsf")) {
            // Page de document : extraire le texte directement
            return this._extractTextFromDocumentPage();
        } else if (url.includes("/liste.jsf")) {
            // Page de liste : récupérer le texte depuis la page de document
            return await this._fetchAndExtractTextFromList();
        }
        
        return null;
    }

    // Extraire l'analyse (pour l'instant non supportée)
    extractAnalysis() {
        const url = window.location.href;
        
        if (url.includes("/document/document.jsf")) {
            // TODO: Implémenter l'extraction d'analyse si disponible sur les pages de document
            this.log("Extraction de l'analyse non encore implémentée sur les pages de document");
            return null;
        } else if (url.includes("/liste.jsf")) {
            this.log("Extraction de l'analyse non disponible sur la page de liste");
            return null;
        }
        
        return null;
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

    // Extraire toutes les URLs des documents (version améliorée)
    extractDocumentUrls() {
        const urls = {
            judgment: null,
            opinion: null,
            judgmentEurLex: null,
            opinionEurLex: null
        };

        try {
            // Parcourir les lignes du tableau des documents
            const documentRows = document.querySelectorAll(".table_document_ligne");
            
            documentRows.forEach(row => {
                const cellDoc = row.querySelector(".liste_table_cell_doc");
                if (!cellDoc) return;
                
                const docType = cellDoc.textContent.trim();
                const cellCuria = row.querySelector(".liste_table_cell_links_curia");
                const cellEurLex = row.querySelector(".liste_table_cell_links_eurlex");
                
                // URL Curia
                if (cellCuria) {
                    const curiaLink = cellCuria.querySelector("a[href*='document/document.jsf']");
                    if (curiaLink) {
                        let href = curiaLink.getAttribute("href").replace(/&amp;/g, '&');
                        const absoluteUrl = this.makeAbsoluteUrl(href);
                        
                        if (docType.includes("Arrêt")) {
                            urls.judgment = absoluteUrl;
                        } else if (docType.includes("Conclusions")) {
                            urls.opinion = absoluteUrl;
                        }
                    }
                }
                
                // URL EUR-Lex
                if (cellEurLex) {
                    const eurLexLink = cellEurLex.querySelector("a[href*='eur-lex.europa.eu']");
                    if (eurLexLink) {
                        const eurLexUrl = eurLexLink.getAttribute("href");
                        
                        if (docType.includes("Arrêt")) {
                            urls.judgmentEurLex = eurLexUrl;
                        } else if (docType.includes("Conclusions")) {
                            urls.opinionEurLex = eurLexUrl;
                        }
                    }
                }
            });
            
            this.log("URLs des documents extraites", urls);
            return urls;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction des URLs", error);
            return urls;
        }
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

    // Extraire l'URL EUR-Lex selon le type de document
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

    // Générer un RIS spécialisé pour Curia
    generateBasicRIS() {
        const metadata = this.extractMetadata();
        if (!metadata) return null;
        
        return window.RISGenerator.generateCuriaRIS(metadata);
    }

    // Générer un RIS complet avec URLs spécifiques pour Curia
    async generateCompleteRIS() {
        const metadata = this.extractMetadata();
        let decisionText = null;
        let analysisText = null;
        let opinionText = null;
        
        try {
            // Gérer les extracteurs asynchrones et synchrones
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

            // Pour les conclusions, extraire depuis la page de liste si disponible
            if (window.location.href.includes("/liste.jsf")) {
                try {
                    opinionText = await this._fetchAndExtractOpinions();
                } catch (error) {
                    this.log("Erreur lors de l'extraction des conclusions", error);
                }
            }
        } catch (error) {
            this.log("Erreur lors de l'extraction du contenu pour RIS complet", error);
        }
        
        if (!metadata) return null;
        
        // Préparer le contenu avec URLs spécifiques
        const content = {
            decisionText: this.formatDecisionText(decisionText),
            analysisText,
            opinionText,
            // Ajouter les URLs spécifiques
            decisionUrl: metadata.documentUrls?.judgmentEurLex || metadata.documentUrls?.judgment || metadata.url,
            opinionUrl: metadata.documentUrls?.opinionEurLex || metadata.documentUrls?.opinion
        };
        
        return this._generateCuriaCompleteRISWithUrls(metadata, content);
    }

    // Générer RIS Curia avec URLs spécifiques
    _generateCuriaCompleteRISWithUrls(metadata, content) {
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
        
        // Ajouter le texte de la décision AVEC URL spécifique
        if (content.decisionText) {
            ris += `N1  - TEXTE DE LA DECISION:\n`;
            
            if (content.decisionUrl) {
                ris += `${content.decisionUrl}\n`;
            }
            
            ris += `${content.decisionText}\n`;
        }
        
        // Ajouter l'analyse si disponible
        if (content.analysisText) {
            ris += `N1  - ANALYSE:\n${content.analysisText}\n`;
        }
        
        // Ajouter les conclusions AVEC URL spécifique
        if (content.opinionText) {
            ris += `N1  - CONCLUSIONS DE L'AVOCAT GENERAL:\n`;
            
            if (content.opinionUrl) {
                ris += `${content.opinionUrl}\n`;
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

    // Formatage spécialisé pour les arrêts de Curia basé sur les classes CSS
    formatDecisionText(rawText) {
        if (!rawText) return null;

        // Si le texte contient déjà des sauts de ligne appropriés, le retourner tel quel
        if (rawText.includes('\n\n') && rawText.split('\n\n').length > 5) {
            this.log("Texte déjà formaté, retour tel quel");
            return rawText;
        }

        try {
            // Si on est sur une page de document, récupérer le HTML
            const documentContent = document.querySelector("#document_content");
            if (documentContent) {
                return this._formatCuriaHtml(documentContent);
            }
            
            // Fallback au texte brut nettoyé
            return window.DOMHelpers.cleanText(rawText);
            
        } catch (error) {
            this.log("Erreur lors du formatage HTML, utilisation du texte brut", error);
            return window.DOMHelpers.cleanText(rawText);
        }
    }

    // Formatter le HTML de Curia selon les classes CSS
    _formatCuriaHtml(documentContent) {
        let formattedText = "";
        
        // Parcourir tous les éléments <p> et autres dans l'ordre
        const elements = documentContent.querySelectorAll('p, h1, h2, h3, div');
        
        elements.forEach((element, index) => {
            const className = element.className;
            const text = element.textContent.trim();
            
            if (!text) return; // Ignorer les éléments vides
            
            // Ajouter le formatage selon la classe CSS
            switch (className) {
                case 'C19Centre':
                    // Titres centrés (ARRÊT DE LA COUR, date)
                    formattedText += (index > 0 ? '\n\n' : '') + text + '\n\n';
                    break;
                    
                case 'C71Indicateur':
                    // Mots-clés entre guillemets
                    formattedText += text + '\n\n';
                    break;
                    
                case 'C01PointnumeroteAltN':
                    // Paragraphes numérotés (1, 2, 3...)
                    formattedText += '\n\n' + text;
                    break;
                    
                case 'C02AlineaAltA':
                    // Paragraphes normaux
                    formattedText += '\n\n' + text;
                    break;
                    
                case 'C04Titre1':
                    // Titres de niveau 1 (Le cadre juridique)
                    formattedText += '\n\n ' + text + '\n\n';
                    break;
                    
                case 'C05Titre2':
                    // Sous-titres (Le droit de l'Union)
                    formattedText += '\n\n ' + text + '\n\n';
                    break;
                    
                case 'C06Titre3':
                    // Sous-sous-titres (La directive 2006/123)
                    formattedText += '\n\n ' + text + '\n\n';
                    break;
                    
                case 'C03Tiretlong':
                    // Listes à puces
                    formattedText += '\n\n' + text;
                    break;
                    
                case 'C09Marge0avecretrait':
                    // Citations indentées
                    formattedText += '\n\n' + text;
                    break;
                    
                case 'C75Debutdesmotifs':
                    // "Arrêt"
                    formattedText += '\n\n' + text + '\n\n';
                    break;
                    
                case 'C08Dispositif':
                case 'C32Dispositifmarge1':
                case 'C34Dispositifmarge1avectiretlong':
                case 'C41DispositifIntroduction':
                    // Dispositif final
                    formattedText += '\n\n' + text;
                    break;
                    
                case 'C77Signatures':
                    // Signatures
                    formattedText += '\n\n' + text + '\n\n';
                    break;
                    
                case 'C42FootnoteLangue':
                    // Notes de bas de page
                    formattedText += '\n\n' + text;
                    break;
                    
                default:
                    // Classes non reconnues - ajouter comme paragraphe normal
                    if (text.length > 10) { // Ignorer les très courts textes
                        formattedText += '\n\n' + text;
                    }
                    break;
            }
        });
        
        // Nettoyer le résultat final
        formattedText = formattedText
            .replace(/\n{3,}/g, '\n\n')  // Maximum 2 sauts de ligne consécutifs
            .trim();
        
        return formattedText;
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

    // Méthode de debug : Afficher toutes les métadonnées extraites
    debugExtraction() {
        const metadata = this.extractMetadata();
        console.table(metadata);
        return metadata;
    }

    // ===== MÉTHODES PRIVÉES =====

    // Extraire les métadonnées depuis une page de liste
    _extractMetadataFromListPage(metadata) {
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

            // Extraire le titre depuis decision_title
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

        // Extraire les URLs spécifiques pour chaque type de document
        const documentUrls = this.extractDocumentUrls();
        metadata.documentUrls = documentUrls;

        // URLs Curia pour arrêt et conclusions
        metadata.curiaJudgmentUrl = documentUrls.judgment;
        metadata.curiaOpinionUrl = documentUrls.opinion;

        // Extraire l'URL EUR-Lex
        metadata.eurLexUrl = this.extractEurLexUrl(metadata.documentType);
        
        // Utiliser l'URL EUR-Lex comme URL principale si disponible
        if (metadata.eurLexUrl) {
            metadata.url = metadata.eurLexUrl;
            metadata.originalCuriaUrl = this.getCurrentUrl();
        } else if (metadata.curiaJudgmentUrl) {
            // Fallback vers l'URL Curia de l'arrêt
            metadata.url = metadata.curiaJudgmentUrl;
        }

        // Extraire les liens vers les documents (legacy)
        metadata.documentLinks = this.extractDocumentLinks();

        this.log("Métadonnées extraites depuis la page de liste", metadata);
        return metadata;
    }

    // Extraire les métadonnées depuis une page de document
    _extractMetadataFromDocumentPage(metadata) {
        // Sur une page de document, l'ECLI est visible
        const ecliElement = document.querySelector(".outputEcli");
        if (ecliElement) {
            metadata.ecli = ecliElement.textContent.trim();
        }

        // Extraire les informations depuis le contenu du document
        const documentContent = document.querySelector("#document_content");
        if (documentContent) {
            // Extraire le texte directement depuis le contenu (pas de balise BODY)
            const bodyText = documentContent.textContent || documentContent.innerText || "";
            
            // Chercher le titre de l'affaire dans le contenu
            // Format typique : "Dans l'affaire C‑278/22,"
            const caseMatch = bodyText.match(/Dans l'affaire\s+([CTF]‑\d+\/\d+)/i);
            if (caseMatch) {
                metadata.caseNumber = caseMatch[1].replace('‑', '-'); // Remplacer le tiret long par tiret normal
                metadata.number = `aff. ${metadata.caseNumber}`;
                metadata.court = this.determineCourtFromCaseNumber(metadata.caseNumber);
            }

            // Chercher le nom du requérant/demandeur
            // Format typique : "AUTOTECHNICA FLEET SERVICES d.o.o.,"
            const nameMatch = bodyText.match(/\*\*([A-Z\s]+[a-z\.]*)\*\*/);
            if (nameMatch) {
                metadata.caseName = nameMatch[1].trim();
            } else {
                // Fallback : chercher dans les balises <b> ou dans le texte après "Dans l'affaire"
                const boldElements = documentContent.querySelectorAll('b');
                for (const bold of boldElements) {
                    const text = bold.textContent.trim();
                    if (text && text.length > 5 && text.toUpperCase() === text && !text.includes('COUR')) {
                        metadata.caseName = text.replace(/,$/, ''); // Enlever la virgule de fin
                        break;
                    }
                }
            }

            // Chercher la date dans le titre
            // Format typique : "21 décembre 2023"
            const dateMatch = bodyText.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
            if (dateMatch) {
                const day = dateMatch[1];
                const month = dateMatch[2];
                const year = dateMatch[3];
                
                metadata.date = `${day} ${month} ${year}`;
                metadata.year = year;
                
                // Convertir le mois en numéro pour le format RIS
                const monthMap = {
                    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
                    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
                    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
                };
                const monthNum = monthMap[month.toLowerCase()];
                if (monthNum) {
                    metadata.dateRIS = `${year}/${monthNum}/${day.padStart(2, '0')}`;
                }
            }

            // Déterminer le type de document
            if (bodyText.includes("ARRÊT DE LA COUR")) {
                metadata.documentType = "Arrêt";
            } else if (bodyText.includes("CONCLUSIONS")) {
                metadata.documentType = "Conclusions";
            } else if (bodyText.includes("ORDONNANCE")) {
                metadata.documentType = "Ordonnance";
            }
        }

        // Construire l'URL EUR-Lex si on a les informations nécessaires
        if (metadata.caseNumber && metadata.year) {
            metadata.eurLexUrl = this.constructEurLexUrl(metadata.documentType);
            if (metadata.eurLexUrl) {
                metadata.url = metadata.eurLexUrl;
                metadata.originalCuriaUrl = this.getCurrentUrl();
            }
        }

        this.log("Métadonnées extraites depuis la page de document", metadata);
        return metadata;
    }

    // Extraire le texte depuis une page de document Curia
    _extractTextFromDocumentPage() {
        try {
            const documentContent = document.querySelector("#document_content");
            if (!documentContent) {
                this.log("Div #document_content non trouvée");
                return null;
            }

            // Formater directement le HTML de la page courante
            const formattedText = this._formatCuriaHtml(documentContent);
            
            this.log("Texte de décision extrait et formaté depuis la page de document", { 
                longueur: formattedText?.length 
            });
            
            return formattedText;
            
        } catch (error) {
            this.log("Erreur lors de l'extraction du texte de décision", error);
            return null;
        }
    }

    // Récupérer et extraire le texte depuis la page de liste (fetch externe)
    async _fetchAndExtractTextFromList() {
        try {
            // 1. Trouver le lien vers l'arrêt
            const judgmentUrl = this._findJudgmentUrl();
            if (!judgmentUrl) {
                this.log("URL de l'arrêt non trouvée dans la page de liste");
                return null;
            }

            this.log("URL de l'arrêt trouvée", judgmentUrl);

            // 2. Récupérer le contenu de la page de l'arrêt
            const response = await fetch(judgmentUrl);
            if (!response.ok) {
                this.log("Erreur lors de la récupération de la page de l'arrêt", response.status);
                return null;
            }

            const htmlText = await response.text();
            
            // 3. Parser le HTML récupéré
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // 4. Extraire le contenu du document
            const documentContent = doc.querySelector("#document_content");
            if (!documentContent) {
                this.log("Div #document_content non trouvée dans la page récupérée");
                return null;
            }

            // 5. Formater directement le HTML récupéré
            const formattedText = this._formatCuriaHtml(documentContent);
            
            this.log("Texte de décision récupéré et formaté depuis la page distante", { 
                longueur: formattedText?.length 
            });
            
            return formattedText;
            
        } catch (error) {
            this.log("Erreur lors de la récupération du texte depuis la page de liste", error);
            return null;
        }
    }

    // Trouver l'URL de l'arrêt depuis la page de liste
    _findJudgmentUrl() {
        try {
            // Chercher la ligne qui contient "Arrêt" dans le tableau des documents
            const documentRows = document.querySelectorAll(".table_document_ligne");
            
            for (const row of documentRows) {
                const cellDoc = row.querySelector(".liste_table_cell_doc");
                if (cellDoc && cellDoc.textContent.includes("Arrêt")) {
                    // Trouvé la ligne de l'arrêt, chercher le lien dans la cellule Curia
                    const cellLinks = row.querySelector(".liste_table_cell_links_curia");
                    if (cellLinks) {
                        const link = cellLinks.querySelector("a[href*='document/document.jsf']");
                        if (link) {
                            let href = link.getAttribute("href");
                            
                            // Convertir les entités HTML (&amp; → &)
                            href = href.replace(/&amp;/g, '&');
                            
                            // Construire l'URL absolue si nécessaire
                            if (href.startsWith("https://")) {
                                return href;
                            } else {
                                return new URL(href, window.location.origin).href;
                            }
                        }
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            this.log("Erreur lors de la recherche de l'URL de l'arrêt", error);
            return null;
        }
    }

    // Trouver l'URL des conclusions depuis la page de liste
    _findOpinionUrl() {
        try {
            // Chercher la ligne qui contient "Conclusions" dans le tableau des documents
            const documentRows = document.querySelectorAll(".table_document_ligne");
            
            for (const row of documentRows) {
                const cellDoc = row.querySelector(".liste_table_cell_doc");
                if (cellDoc && cellDoc.textContent.includes("Conclusions")) {
                    // Trouvé la ligne des conclusions, chercher le lien dans la cellule Curia
                    const cellLinks = row.querySelector(".liste_table_cell_links_curia");
                    if (cellLinks) {
                        const link = cellLinks.querySelector("a[href*='document/document.jsf']");
                        if (link) {
                            let href = link.getAttribute("href");
                            
                            // Convertir les entités HTML (&amp; → &)
                            href = href.replace(/&amp;/g, '&');
                            
                            // Construire l'URL absolue si nécessaire
                            if (href.startsWith("https://")) {
                                return href;
                            } else {
                                return new URL(href, window.location.origin).href;
                            }
                        }
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            this.log("Erreur lors de la recherche de l'URL des conclusions", error);
            return null;
        }
    }

    // Récupérer et extraire le texte des conclusions
    async _fetchAndExtractOpinions() {
        try {
            // 1. Trouver le lien vers les conclusions
            const opinionUrl = this._findOpinionUrl();
            if (!opinionUrl) {
                this.log("URL des conclusions non trouvée dans la page de liste");
                return null;
            }

            this.log("URL des conclusions trouvée", opinionUrl);

            // 2. Récupérer le contenu de la page des conclusions
            const response = await fetch(opinionUrl);
            if (!response.ok) {
                this.log("Erreur lors de la récupération de la page des conclusions", response.status);
                return null;
            }

            const htmlText = await response.text();
            
            // 3. Parser le HTML récupéré
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // 4. Extraire le contenu du document
            const documentContent = doc.querySelector("#document_content");
            if (!documentContent) {
                this.log("Div #document_content non trouvée dans la page des conclusions");
                return null;
            }

            // 5. Formater directement le HTML récupéré
            const formattedText = this._formatCuriaHtml(documentContent);
            
            this.log("Texte des conclusions récupéré et formaté", { 
                longueur: formattedText?.length 
            });
            
            return formattedText;
            
        } catch (error) {
            this.log("Erreur lors de la récupération des conclusions", error);
            return null;
        }
    }
};