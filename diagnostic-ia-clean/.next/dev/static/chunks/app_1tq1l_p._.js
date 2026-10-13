(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/lib/erreurs-auth.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Messages de Supabase (en anglais) traduits en phrases simples, pour la connexion,
// l'inscription et le mot de passe oublié.
__turbopack_context__.s([
    "champAuth",
    ()=>champAuth,
    "lienNouveauMotDePasse",
    ()=>lienNouveauMotDePasse,
    "traduireErreurAuth",
    ()=>traduireErreurAuth
]);
function traduireErreurAuth(message) {
    const m = (message ?? '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (m.includes('email not confirmed')) return 'Votre email n’est pas encore confirmé : cliquez sur le lien reçu par email (pensez à regarder dans les spams).';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email. Connectez-vous, ou utilisez « Mot de passe oublié ».';
    if (m.includes('different from the old')) return 'Le nouveau mot de passe doit être différent de l’ancien.';
    if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('short'))) {
        return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.';
    }
    if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Trop de tentatives. Patientez une minute, puis réessayez.';
    if (m.includes('expired') || m.includes('invalid') && (m.includes('token') || m.includes('link') || m.includes('otp'))) {
        return 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien.';
    }
    if (m.includes('signup') && m.includes('disabled')) return 'Les inscriptions sont fermées pour le moment.';
    if (m.includes('invalid') && m.includes('email')) return 'Adresse email invalide.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion impossible. Vérifiez votre connexion internet.';
    return 'Une erreur est survenue. Réessayez dans un instant.';
}
const lienNouveauMotDePasse = ()=>`${window.location.origin}/reset-password`;
const champAuth = 'w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder:italic placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/lib/redirection.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Après la connexion ou l'inscription : où renvoyer la personne ?
// Exemple : /login?suite=/invitation/xxxx → après connexion, on ouvre l'invitation.
__turbopack_context__.s([
    "avecSuite",
    ()=>avecSuite,
    "lireSuite",
    ()=>lireSuite,
    "sAbonnerAucunChangement",
    ()=>sAbonnerAucunChangement
]);
function lireSuite() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const suite = new URLSearchParams(window.location.search).get('suite');
    // Sécurité : uniquement une page de CE site (commence par "/", mais pas "//" qui mènerait ailleurs)
    return suite && suite.startsWith('/') && !suite.startsWith('//') && !suite.includes('\\') ? suite : null;
}
function avecSuite(page, suite) {
    return suite ? `${page}?suite=${encodeURIComponent(suite)}` : page;
}
const sAbonnerAucunChangement = ()=>()=>{};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-client] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://nhjwzbmgpnqpyjlmkqll.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "sb_publishable_qh-ztrn0Ij9Zhpr1iQYgHA_ZuCkVrxd");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/signup/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SignupPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Page d'INSCRIPTION.
// Après l'inscription, Supabase envoie un email de confirmation : on l'explique clairement à l'écran.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/redirection.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$erreurs$2d$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/erreurs-auth.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function SignupPage() {
    _s();
    const [nom, setNom] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [emailEnvoye, setEmailEnvoye] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    // Page où revenir après l'inscription (ex. une invitation d'équipe)
    const suite = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sAbonnerAucunChangement"], __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lireSuite"], {
        "SignupPage.useSyncExternalStore[suite]": ()=>null
    }["SignupPage.useSyncExternalStore[suite]"]);
    const handleSignup = async (e)=>{
        e.preventDefault();
        setError('');
        if (password.length < 8) {
            setError('Mot de passe trop court : au moins 8 caractères.');
            return;
        }
        setLoading(true);
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: {
                    nom_complet: nom.trim()
                },
                // Le lien de l'email de confirmation ramène sur la page de connexion de CE site
                emailRedirectTo: `${window.location.origin}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["avecSuite"])('/login', suite)}`
            }
        });
        setLoading(false);
        if (error) {
            setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$erreurs$2d$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["traduireErreurAuth"])(error.message));
            return;
        }
        // Si la confirmation par email est désactivée dans Supabase, on est déjà connecté
        if (data.session) {
            router.push(suite ?? '/dashboard');
            return;
        }
        setEmailEnvoye(true);
    };
    if (emailEnvoye) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full max-w-md rounded-xl bg-gray-800 p-8 text-center shadow-lg",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-5xl",
                        "aria-hidden": true,
                        children: "📩"
                    }, void 0, false, {
                        fileName: "[project]/app/signup/page.tsx",
                        lineNumber: 56,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "mt-4 text-2xl font-bold",
                        children: "Vérifiez votre boîte mail"
                    }, void 0, false, {
                        fileName: "[project]/app/signup/page.tsx",
                        lineNumber: 57,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-gray-300",
                        children: [
                            "Un email de confirmation a été envoyé à ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                className: "text-white",
                                children: email.trim()
                            }, void 0, false, {
                                fileName: "[project]/app/signup/page.tsx",
                                lineNumber: 59,
                                columnNumber: 53
                            }, this),
                            ". Cliquez sur le lien qu’il contient pour activer votre compte."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/signup/page.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-sm text-gray-400",
                        children: "Rien reçu après 2 minutes ? Regardez dans les spams."
                    }, void 0, false, {
                        fileName: "[project]/app/signup/page.tsx",
                        lineNumber: 62,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["avecSuite"])('/login', suite),
                        className: "mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700",
                        children: "Aller à la connexion"
                    }, void 0, false, {
                        fileName: "[project]/app/signup/page.tsx",
                        lineNumber: 63,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/signup/page.tsx",
                lineNumber: 55,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/signup/page.tsx",
            lineNumber: 54,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-lg",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: "/",
                    className: "block text-center text-sm font-semibold text-blue-400",
                    children: "Diagnostic IA"
                }, void 0, false, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 74,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "mb-8 mt-2 text-center text-3xl font-bold",
                    children: "Créer un compte"
                }, void 0, false, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 75,
                    columnNumber: 9
                }, this),
                suite?.startsWith('/invitation/') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-4 rounded-lg border border-blue-700 bg-blue-950 p-3 text-sm text-blue-100",
                    children: "👥 Créez votre compte avec l’adresse email qui a reçu l’invitation."
                }, void 0, false, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 78,
                    columnNumber: 11
                }, this),
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    role: "alert",
                    className: "mb-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200",
                    children: [
                        "⚠️ ",
                        error
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 84,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    className: "space-y-5",
                    onSubmit: handleSignup,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: "nom",
                                    className: "mb-2 block text-gray-300",
                                    children: "Nom complet"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 89,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "nom",
                                    type: "text",
                                    autoComplete: "name",
                                    value: nom,
                                    onChange: (e)=>setNom(e.target.value),
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$erreurs$2d$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["champAuth"],
                                    placeholder: "ex. : Jean Dupont",
                                    required: true
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 90,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 88,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: "email",
                                    className: "mb-2 block text-gray-300",
                                    children: "Email"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 94,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "email",
                                    type: "email",
                                    autoComplete: "email",
                                    value: email,
                                    onChange: (e)=>setEmail(e.target.value),
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$erreurs$2d$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["champAuth"],
                                    placeholder: "ex. : prenom@cabinet.fr",
                                    required: true
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 95,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 93,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: "mot-de-passe",
                                    className: "mb-2 block text-gray-300",
                                    children: "Mot de passe"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 99,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "mot-de-passe",
                                    type: "password",
                                    autoComplete: "new-password",
                                    minLength: 8,
                                    value: password,
                                    onChange: (e)=>setPassword(e.target.value),
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$erreurs$2d$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["champAuth"],
                                    placeholder: "8 caractères minimum",
                                    required: true,
                                    "aria-describedby": "aide-mot-de-passe"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 100,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    id: "aide-mot-de-passe",
                                    className: "mt-1 text-xs text-gray-400",
                                    children: "Au moins 8 caractères, avec des lettres et des chiffres."
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 103,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 98,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-gray-400",
                            children: [
                                "En créant un compte, vous acceptez les",
                                ' ',
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: "/cgv",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    className: "text-blue-300 underline",
                                    children: "conditions générales"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 108,
                                    columnNumber: 13
                                }, this),
                                ' ',
                                "et la",
                                ' ',
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: "/confidentialite",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    className: "text-blue-300 underline",
                                    children: "politique de confidentialité"
                                }, void 0, false, {
                                    fileName: "[project]/app/signup/page.tsx",
                                    lineNumber: 110,
                                    columnNumber: 13
                                }, this),
                                "."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 106,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "submit",
                            disabled: loading,
                            className: "w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50",
                            children: loading ? 'Inscription…' : 'S’inscrire'
                        }, void 0, false, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 113,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 87,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-6 text-center text-gray-400",
                    children: [
                        "Déjà un compte ?",
                        ' ',
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$redirection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["avecSuite"])('/login', suite),
                            className: "text-blue-400 hover:underline",
                            children: "Se connecter"
                        }, void 0, false, {
                            fileName: "[project]/app/signup/page.tsx",
                            lineNumber: 121,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/signup/page.tsx",
                    lineNumber: 119,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/signup/page.tsx",
            lineNumber: 73,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/signup/page.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
_s(SignupPage, "TCRzglwgBZovIdTV7GtO+gZ41Rk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
_c = SignupPage;
var _c;
__turbopack_context__.k.register(_c, "SignupPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_1tq1l_p._.js.map