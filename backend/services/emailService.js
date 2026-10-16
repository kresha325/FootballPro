const nodemailer = require('nodemailer');
const { isEmailConfigured, isResendConfigured, buildParentConfirmUrl } = require('../config/email');

let transporter = null;

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 0);
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port || 587,
        secure: port === 465,
        // Some hosts (including container platforms) expose only an internal
        // IPv4 interface. Let Nodemailer still resolve the SMTP host's IPv4
        // address instead of selecting an unreachable IPv6 address.
        allowInternalNetworkInterfaces: true,
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        allowInternalNetworkInterfaces: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

const emailCopy = {
  sq: {
    resetSubject: '🔐 Rivendos fjalëkalimin e X TALENTI', resetTitle: 'Rivendos fjalëkalimin', hi: 'Përshëndetje',
    resetBody: 'Kemi marrë një kërkesë për rivendosjen e fjalëkalimit të X TALENTI. Shtyp butonin për të zgjedhur një fjalëkalim të ri. Ky link skadon pas një ore.',
    resetButton: 'Rivendos fjalëkalimin', ignore: 'Nëse nuk e ke kërkuar këtë, mund ta shpërfillësh këtë email.',
    welcomeSubject: '🏆 Mirë se vjen në X TALENTI!', welcomeTitle: 'Mirë se vjen në X TALENTI',
    welcomeBody: 'Faleminderit që iu bashkove komunitetit tonë ndërkombëtar të futbollit.', welcomeNext: 'Plotëso profilin dhe lidhu me lojtarë, skautë e klube në mbarë botën.', welcomeButton: 'Fillo tani',
    parentSubject: 'X TALENTI — konfirmim prindi', parentTitle: 'Konfirmim prindi ose kujdestari', parentBody: 'Për të aktivizuar llogarinë e një të mituri nën 18 vjeç, nevojitet miratimi yt si prind ose kujdestar ligjor.', parentAction: 'Konfirmo si prind', parentFallback: 'Nëse butoni nuk funksionon, hape këtë link në shfletues:', parentIgnore: 'Nëse nuk e prisje këtë email, mund ta shpërfillësh.',
  },
  en: {
    resetSubject: '🔐 Reset your X TALENTI password', resetTitle: 'Password reset', hi: 'Hi',
    resetBody: 'We received a request to reset your X TALENTI password. Click the button below to choose a new password. This link expires in one hour.',
    resetButton: 'Reset password', ignore: 'If you did not request this, you can ignore this email.',
    welcomeSubject: '🏆 Welcome to X TALENTI!', welcomeTitle: 'Welcome to X TALENTI',
    welcomeBody: 'Thank you for joining our global football community.', welcomeNext: 'Build your profile and connect with players, scouts, and clubs worldwide.', welcomeButton: 'Get started',
    parentSubject: 'X TALENTI — parental approval', parentTitle: 'Parent or guardian approval', parentBody: 'An adult’s approval is required to activate an account for someone under 18.', parentAction: 'Confirm as parent', parentFallback: 'If the button does not work, open this link in your browser:', parentIgnore: 'If you were not expecting this email, you can ignore it.',
  },
  de: {
    resetSubject: '🔐 X TALENTI Passwort zurücksetzen', resetTitle: 'Passwort zurücksetzen', hi: 'Hallo', resetBody: 'Wir haben eine Anfrage zum Zurücksetzen deines X TALENTI Passworts erhalten. Wähle über die Schaltfläche ein neues Passwort. Dieser Link ist eine Stunde gültig.', resetButton: 'Passwort zurücksetzen', ignore: 'Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
    welcomeSubject: '🏆 Willkommen bei X TALENTI!', welcomeTitle: 'Willkommen bei X TALENTI', welcomeBody: 'Danke, dass du unserer internationalen Fußballgemeinschaft beigetreten bist.', welcomeNext: 'Erstelle dein Profil und vernetze dich weltweit mit Spielern, Scouts und Vereinen.', welcomeButton: 'Jetzt starten',
    parentSubject: 'X TALENTI — Zustimmung der Eltern', parentTitle: 'Zustimmung der Eltern oder Erziehungsberechtigten', parentBody: 'Für ein Konto einer Person unter 18 Jahren ist die Zustimmung der Eltern oder Erziehungsberechtigten erforderlich.', parentAction: 'Als Elternteil bestätigen', parentFallback: 'Falls die Schaltfläche nicht funktioniert, öffne diesen Link im Browser:', parentIgnore: 'Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.',
  },
  fr: {
    resetSubject: '🔐 Réinitialisez votre mot de passe X TALENTI', resetTitle: 'Réinitialisation du mot de passe', hi: 'Bonjour', resetBody: 'Nous avons reçu une demande de réinitialisation de votre mot de passe X TALENTI. Cliquez ci-dessous pour en choisir un nouveau. Ce lien expire dans une heure.', resetButton: 'Réinitialiser le mot de passe', ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
    welcomeSubject: '🏆 Bienvenue sur X TALENTI !', welcomeTitle: 'Bienvenue sur X TALENTI', welcomeBody: 'Merci d’avoir rejoint notre communauté mondiale de football.', welcomeNext: 'Créez votre profil et échangez avec des joueurs, recruteurs et clubs du monde entier.', welcomeButton: 'Commencer',
    parentSubject: 'X TALENTI — accord parental', parentTitle: 'Accord du parent ou tuteur', parentBody: 'L’accord d’un parent ou tuteur est nécessaire pour activer le compte d’une personne de moins de 18 ans.', parentAction: 'Confirmer en tant que parent', parentFallback: 'Si le bouton ne fonctionne pas, ouvrez ce lien dans votre navigateur :', parentIgnore: 'Si vous n’attendiez pas cet e-mail, vous pouvez l’ignorer.',
  },
  it: {
    resetSubject: '🔐 Reimposta la password X TALENTI', resetTitle: 'Reimpostazione password', hi: 'Ciao', resetBody: 'Abbiamo ricevuto una richiesta per reimpostare la password X TALENTI. Premi il pulsante per sceglierne una nuova. Il link scade tra un’ora.', resetButton: 'Reimposta password', ignore: 'Se non hai richiesto questa operazione, puoi ignorare questa email.',
    welcomeSubject: '🏆 Benvenuto su X TALENTI!', welcomeTitle: 'Benvenuto su X TALENTI', welcomeBody: 'Grazie per esserti unito alla nostra comunità calcistica globale.', welcomeNext: 'Crea il tuo profilo e connettiti con giocatori, scout e club di tutto il mondo.', welcomeButton: 'Inizia ora',
    parentSubject: 'X TALENTI — autorizzazione genitoriale', parentTitle: 'Autorizzazione del genitore o tutore', parentBody: 'Per attivare l’account di una persona minore di 18 anni è necessaria l’autorizzazione di un genitore o tutore legale.', parentAction: 'Conferma come genitore', parentFallback: 'Se il pulsante non funziona, apri questo link nel browser:', parentIgnore: 'Se non aspettavi questa email, puoi ignorarla.',
  },
  es: {
    resetSubject: '🔐 Restablece tu contraseña de X TALENTI', resetTitle: 'Restablecer contraseña', hi: 'Hola', resetBody: 'Hemos recibido una solicitud para restablecer tu contraseña de X TALENTI. Pulsa el botón para elegir una nueva. El enlace caduca en una hora.', resetButton: 'Restablecer contraseña', ignore: 'Si no solicitaste esto, puedes ignorar este correo.',
    welcomeSubject: '🏆 ¡Te damos la bienvenida a X TALENTI!', welcomeTitle: 'Te damos la bienvenida a X TALENTI', welcomeBody: 'Gracias por unirte a nuestra comunidad futbolística global.', welcomeNext: 'Crea tu perfil y conecta con jugadores, ojeadores y clubes de todo el mundo.', welcomeButton: 'Empezar',
    parentSubject: 'X TALENTI — autorización parental', parentTitle: 'Autorización del padre, madre o tutor', parentBody: 'Se necesita la autorización de un padre, madre o tutor legal para activar la cuenta de una persona menor de 18 años.', parentAction: 'Confirmar como tutor', parentFallback: 'Si el botón no funciona, abre este enlace en tu navegador:', parentIgnore: 'Si no esperabas este correo, puedes ignorarlo.',
  },
  ro: {
    resetSubject: '🔐 Resetează parola X TALENTI', resetTitle: 'Resetarea parolei', hi: 'Salut', resetBody: 'Am primit o solicitare de resetare a parolei X TALENTI. Apasă butonul pentru a alege o parolă nouă. Linkul expiră într-o oră.', resetButton: 'Resetează parola', ignore: 'Dacă nu ai solicitat acest lucru, poți ignora acest e-mail.',
    welcomeSubject: '🏆 Bun venit la X TALENTI!', welcomeTitle: 'Bun venit la X TALENTI', welcomeBody: 'Îți mulțumim că te-ai alăturat comunității noastre globale de fotbal.', welcomeNext: 'Creează-ți profilul și conectează-te cu jucători, scouteri și cluburi din întreaga lume.', welcomeButton: 'Începe acum',
    parentSubject: 'X TALENTI — acord parental', parentTitle: 'Acordul părintelui sau tutorelui', parentBody: 'Este necesar acordul unui părinte sau tutore legal pentru activarea contului unei persoane sub 18 ani.', parentAction: 'Confirmă ca părinte', parentFallback: 'Dacă butonul nu funcționează, deschide acest link în browser:', parentIgnore: 'Dacă nu așteptai acest e-mail, îl poți ignora.',
  },
  hr: {
    resetSubject: '🔐 Ponovno postavi lozinku za X TALENTI', resetTitle: 'Ponovno postavljanje lozinke', hi: 'Pozdrav', resetBody: 'Primili smo zahtjev za ponovno postavljanje lozinke za X TALENTI. Pritisni gumb i odaberi novu lozinku. Poveznica vrijedi jedan sat.', resetButton: 'Ponovno postavi lozinku', ignore: 'Ako nisi zatražio/la ovu promjenu, možeš zanemariti ovu e-poštu.',
    welcomeSubject: '🏆 Dobro došao/la na X TALENTI!', welcomeTitle: 'Dobro došao/la na X TALENTI', welcomeBody: 'Hvala ti što si se pridružio/la našoj globalnoj nogometnoj zajednici.', welcomeNext: 'Izradi profil i poveži se s igračima, skautima i klubovima diljem svijeta.', welcomeButton: 'Započni',
    parentSubject: 'X TALENTI — roditeljska suglasnost', parentTitle: 'Suglasnost roditelja ili skrbnika', parentBody: 'Za aktivaciju računa osobe mlađe od 18 godina potrebna je suglasnost roditelja ili zakonskog skrbnika.', parentAction: 'Potvrdi kao roditelj', parentFallback: 'Ako gumb ne radi, otvori ovu poveznicu u pregledniku:', parentIgnore: 'Ako nisi očekivao/la ovu e-poštu, možeš je zanemariti.',
  },
  tr: {
    resetSubject: '🔐 X TALENTI şifreni sıfırla', resetTitle: 'Şifre sıfırlama', hi: 'Merhaba', resetBody: 'X TALENTI şifreni sıfırlamak için bir istek aldık. Yeni şifre belirlemek için aşağıdaki düğmeye tıkla. Bu bağlantı bir saat içinde sona erer.', resetButton: 'Şifreyi sıfırla', ignore: 'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.',
    welcomeSubject: '🏆 X TALENTI’ye hoş geldin!', welcomeTitle: 'X TALENTI’ye hoş geldin', welcomeBody: 'Küresel futbol topluluğumuza katıldığın için teşekkür ederiz.', welcomeNext: 'Profilini oluştur ve dünyanın dört bir yanındaki oyuncular, scoutlar ve kulüplerle bağlantı kur.', welcomeButton: 'Başla',
    parentSubject: 'X TALENTI — ebeveyn onayı', parentTitle: 'Ebeveyn veya vasi onayı', parentBody: '18 yaşından küçük bir kişinin hesabını etkinleştirmek için ebeveyn veya yasal vasinin onayı gerekir.', parentAction: 'Ebeveyn olarak onayla', parentFallback: 'Düğme çalışmazsa bu bağlantıyı tarayıcında aç:', parentIgnore: 'Bu e-postayı beklemiyorsan yok sayabilirsin.',
  },
};

function copyFor(language) {
  return emailCopy[String(language || 'sq').toLowerCase()] || emailCopy.sq;
}

const notificationEmailCopy = {
  sq: { newMessage: 'Mesazh i ri nga', reply: 'Përgjigju tani', notice: 'Njoftim', open: 'Hape në X TALENTI' },
  en: { newMessage: 'New message from', reply: 'Reply now', notice: 'Notice', open: 'Open X TALENTI' },
  de: { newMessage: 'Neue Nachricht von', reply: 'Jetzt antworten', notice: 'Mitteilung', open: 'X TALENTI öffnen' },
  fr: { newMessage: 'Nouveau message de', reply: 'Répondre maintenant', notice: 'Information', open: 'Ouvrir X TALENTI' },
  it: { newMessage: 'Nuovo messaggio da', reply: 'Rispondi ora', notice: 'Avviso', open: 'Apri X TALENTI' },
  es: { newMessage: 'Nuevo mensaje de', reply: 'Responder ahora', notice: 'Aviso', open: 'Abrir X TALENTI' },
  ro: { newMessage: 'Mesaj nou de la', reply: 'Răspunde acum', notice: 'Notificare', open: 'Deschide X TALENTI' },
  hr: { newMessage: 'Nova poruka od', reply: 'Odgovori odmah', notice: 'Obavijest', open: 'Otvori X TALENTI' },
  tr: { newMessage: 'Yeni mesaj gönderen', reply: 'Şimdi yanıtla', notice: 'Bildirim', open: 'X TALENTI’yi aç' },
};

function notificationCopy(language) {
  return notificationEmailCopy[String(language || 'sq').toLowerCase()] || notificationEmailCopy.sq;
}

const rosterEmailCopy = {
  sq: { request: 'Kërkesë e re për skuadrën', wants: 'dëshiron t’i bashkohet skuadrës si', review: 'Shqyrto kërkesën', approved: 'Kërkesa u aprovua', congrats: 'Urime!', joined: 'e ka aprovuar kërkesën tënde për t’iu bashkuar skuadrës si', details: 'Shiko hollësitë', rejected: 'Përditësim i kërkesës për skuadrën', reviewed: 'e ka shqyrtuar kërkesën tënde për skuadrën si', encourage: 'Vazhdo të zhvillohesh dhe provo përsëri më vonë.', other: 'Gjej klube të tjera', message: 'Mesazhi' },
  en: { request: 'New roster request', wants: 'wants to join your roster as', review: 'Review request', approved: 'Roster request approved', congrats: 'Congratulations!', joined: 'approved your request to join the roster as', details: 'View details', rejected: 'Roster request update', reviewed: 'reviewed your roster request for', encourage: 'Keep developing and try again later.', other: 'Find other clubs', message: 'Message' },
  de: { request: 'Neue Kaderanfrage', wants: 'möchte dem Kader beitreten als', review: 'Anfrage prüfen', approved: 'Kaderanfrage genehmigt', congrats: 'Glückwunsch!', joined: 'hat deine Anfrage zum Beitritt als genehmigt', details: 'Details ansehen', rejected: 'Aktualisierung der Kaderanfrage', reviewed: 'hat deine Kaderanfrage geprüft für', encourage: 'Entwickle dich weiter und versuche es später erneut.', other: 'Andere Vereine finden', message: 'Nachricht' },
  fr: { request: 'Nouvelle demande pour l’effectif', wants: 'souhaite rejoindre votre effectif comme', review: 'Examiner la demande', approved: 'Demande approuvée', congrats: 'Félicitations !', joined: 'a approuvé votre demande pour rejoindre l’effectif comme', details: 'Voir les détails', rejected: 'Mise à jour de la demande', reviewed: 'a examiné votre demande pour le poste', encourage: 'Continuez à progresser et réessayez plus tard.', other: 'Trouver d’autres clubs', message: 'Message' },
  it: { request: 'Nuova richiesta per la rosa', wants: 'vuole unirsi alla rosa come', review: 'Esamina la richiesta', approved: 'Richiesta approvata', congrats: 'Congratulazioni!', joined: 'ha approvato la tua richiesta di entrare in rosa come', details: 'Vedi dettagli', rejected: 'Aggiornamento della richiesta', reviewed: 'ha esaminato la tua richiesta per il ruolo', encourage: 'Continua a migliorare e riprova più avanti.', other: 'Trova altri club', message: 'Messaggio' },
  es: { request: 'Nueva solicitud para la plantilla', wants: 'quiere unirse a tu plantilla como', review: 'Revisar solicitud', approved: 'Solicitud aprobada', congrats: '¡Enhorabuena!', joined: 'ha aprobado tu solicitud para unirte a la plantilla como', details: 'Ver detalles', rejected: 'Actualización de la solicitud', reviewed: 'ha revisado tu solicitud para el puesto', encourage: 'Sigue mejorando e inténtalo de nuevo más adelante.', other: 'Encontrar otros clubes', message: 'Mensaje' },
  ro: { request: 'Cerere nouă pentru lot', wants: 'dorește să se alăture lotului ca', review: 'Examinează cererea', approved: 'Cerere aprobată', congrats: 'Felicitări!', joined: 'ți-a aprobat cererea de a intra în lot ca', details: 'Vezi detaliile', rejected: 'Actualizare a cererii', reviewed: 'ți-a examinat cererea pentru rolul', encourage: 'Continuă să evoluezi și încearcă din nou mai târziu.', other: 'Găsește alte cluburi', message: 'Mesaj' },
  hr: { request: 'Novi zahtjev za sastav', wants: 'želi se pridružiti sastavu kao', review: 'Pregledaj zahtjev', approved: 'Zahtjev odobren', congrats: 'Čestitamo!', joined: 'odobrio je tvoj zahtjev za pridruživanje sastavu kao', details: 'Pogledaj pojedinosti', rejected: 'Ažuriranje zahtjeva', reviewed: 'pregledao je tvoj zahtjev za poziciju', encourage: 'Nastavi napredovati i pokušaj ponovno kasnije.', other: 'Pronađi druge klubove', message: 'Poruka' },
  tr: { request: 'Yeni kadro başvurusu', wants: 'kadroya şu pozisyonda katılmak istiyor:', review: 'Başvuruyu incele', approved: 'Kadro başvurusu onaylandı', congrats: 'Tebrikler!', joined: 'kadroya şu pozisyonda katılma başvurunu onayladı:', details: 'Detayları görüntüle', rejected: 'Kadro başvurusu güncellemesi', reviewed: 'kadro başvurunu şu pozisyon için inceledi:', encourage: 'Gelişmeye devam et ve daha sonra tekrar dene.', other: 'Diğer kulüpleri bul', message: 'Mesaj' },
};

function rosterCopy(language) {
  return rosterEmailCopy[String(language || 'sq').toLowerCase()] || rosterEmailCopy.sq;
}

// Email templates
const emailTemplates = {
  passwordReset: (firstName, resetUrl, language = 'sq') => {
    const c = copyFor(language);
    return {
    subject: c.resetSubject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">${c.resetTitle}</h1>
        <p>${c.hi} ${firstName || ''},</p>
        <p>${c.resetBody}</p>
        <a href="${resetUrl}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.resetButton}
        </a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">${c.ignore}</p>
      </div>
    `
    };
  },

  welcome: (firstName, language = 'sq') => {
    const c = copyFor(language);
    return {
    subject: c.welcomeSubject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">${c.welcomeTitle}, ${firstName || ''}!</h1>
        <p>${c.welcomeBody}</p>
        <p>${c.welcomeNext}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.welcomeButton}
        </a>
      </div>
    `
    };
  },

  newFollower: (followerName, userId) => ({
    subject: `🔔 ${followerName} started following you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${followerName} is now following you on X TALENTI</h2>
        <p>Check out their profile and connect!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/profile/${userId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Profile
        </a>
      </div>
    `
  }),

  newLike: (likerName, postId) => ({
    subject: `👍 ${likerName} liked your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${likerName} liked your post</h2>
        <p>Your content is getting noticed!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Post
        </a>
      </div>
    `
  }),

  newComment: (commenterName, comment, postId) => ({
    subject: `💬 ${commenterName} commented on your post`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${commenterName} commented:</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">"${comment}"</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/feed?post=${postId}"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Comment
        </a>
      </div>
    `
  }),

  newMessage: (senderName, preview, conversationId, language = 'sq') => {
    const c = notificationCopy(language);
    return {
    subject: `📨 ${c.newMessage} ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.newMessage} ${senderName}</h2>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${preview}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/messaging"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.reply}
        </a>
      </div>
    `
  }; },

  scoutingRecommendation: (scoutName, clubName) => ({
    subject: `🔍 ${scoutName} from ${clubName} is interested in you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been scouted!</h2>
        <p><strong>${scoutName}</strong> from <strong>${clubName}</strong> has shown interest in your profile.</p>
        <p>This could be your big opportunity!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/scouting"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Details
        </a>
      </div>
    `
  }),

  tournamentInvite: (tournamentName, tournamentId) => ({
    subject: `🏆 You're invited to ${tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Tournament Invitation</h2>
        <p>You've been invited to participate in <strong>${tournamentName}</strong></p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/tournaments"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          View Tournament
        </a>
      </div>
    `
  }),

  premiumExpiring: (firstName, daysLeft) => ({
    subject: `⏰ Your Premium expires in ${daysLeft} days`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Premium Subscription Expiring</h2>
        <p>Hi ${firstName},</p>
        <p>Your Premium subscription will expire in <strong>${daysLeft} days</strong>.</p>
        <p>Renew now to keep your premium features!</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/premium"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Renew Premium
        </a>
      </div>
    `
  }),

  rosterRequest: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `🏆 ${c.request} — ${data.athleteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.request}</h2>
        <p>${copyFor(data.language).hi} ${data.clubName},</p>
        <p><strong>${data.athleteName}</strong> ${c.wants} <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${c.message}: "${data.message}"</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/requests"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.review}
        </a>
      </div>
    `
  }; },

  rosterApproved: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `🎉 ${c.approved} — ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.congrats}</h2>
        <p>${copyFor(data.language).hi} ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> ${c.joined} <strong>${data.position}</strong>!</p>
        ${data.message ? `<p style="background: #dcfce7; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/roster/my-requests"
           style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.details}
        </a>
      </div>
    `
  }; },
  parentVerification: (athleteName, token, language = 'sq') => {
    const confirmUrl = buildParentConfirmUrl(token);
    const c = copyFor(language);
    return {
      subject: `${c.parentSubject} — ${athleteName}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="color: #0f766e;">${c.parentTitle}</h2>
        <p>${c.hi},</p>
        <p>${c.parentBody}</p>
        <a href="${confirmUrl}"
           style="background: #0f766e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold;">
          ${c.parentAction}
        </a>
        <p style="color:#6b7280; font-size:13px;">${c.parentFallback}</p>
        <p style="word-break: break-all; font-size:12px; color:#475569;">${confirmUrl}</p>
        <p style="margin-top:20px; color:#9ca3af; font-size:12px;">${c.parentIgnore}</p>
        <p style="color:#9ca3af; font-size:12px;">— <strong>X TALENTI</strong></p>
      </div>
    `,
    };
  },

  importantNotice: (firstName, title, message, url, language = 'sq') => {
    const c = notificationCopy(language);
    return {
    subject: title || c.notice,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #9A6B12;">${title || c.notice}</h2>
        <p>${copyFor(language).hi} ${firstName || ''},</p>
        <p>${message || ''}</p>
        ${url ? `<a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}${url}"
           style="background: #9A6B12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.open}
        </a>` : ''}
      </div>
    `,
  }; },

  rosterRejected: (data) => {
    const c = rosterCopy(data.language);
    return {
    subject: `${c.rejected} — ${data.clubName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.rejected}</h2>
        <p>${copyFor(data.language).hi} ${data.athleteName},</p>
        <p><strong>${data.clubName}</strong> ${c.reviewed} <strong>${data.position}</strong>.</p>
        ${data.message ? `<p style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;">${data.message}</p>` : ''}
        <p>${c.encourage}</p>
        <a href="${process.env.FRONTEND_URL || 'https://xtalenti.com'}/search?role=club"
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          ${c.other}
        </a>
      </div>
    `
  }; }
};

// Send email function
const sendEmail = async (to, templateName, ...params) => {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey && !isResendConfigured()) {
    console.error('❌ Email error: RESEND_FROM is required when RESEND_API_KEY is set');
    return { success: false, error: 'RESEND_FROM_NOT_CONFIGURED' };
  }

  if (!isEmailConfigured()) {
    console.warn('📧 Email skipped — configure Resend or SMTP credentials on server');
    return { success: false, error: 'EMAIL_NOT_CONFIGURED', skipped: true };
  }

  try {
    const template = emailTemplates[templateName](...params);

    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM.trim(),
          to: [to],
          subject: template.subject,
          html: template.html,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = result.message || result.error || `HTTP ${response.status}`;
        console.error('❌ Email API error:', templateName, '→', to, reason);
        return { success: false, error: String(reason) };
      }

      console.log('✅ Email sent:', templateName, '→', to, result.id || 'accepted by Resend');
      return { success: true, messageId: result.id || null };
    }

    const transport = getTransporter();
    if (!transport) {
      return { success: false, error: 'EMAIL_TRANSPORT_UNAVAILABLE' };
    }

    const mailOptions = {
      from: `"X TALENTI" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    };

    const info = await transport.sendMail(mailOptions);
    console.log('✅ Email sent:', templateName, '→', to, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', templateName, '→', to, error.message);
    return { success: false, error: error.message };
  }
};

// Batch email sending
const sendBulkEmails = async (recipients, templateName, ...params) => {
  const results = await Promise.allSettled(
    recipients.map(email => sendEmail(email, templateName, ...params))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`📧 Bulk email: ${successful} sent, ${failed} failed`);
  return { successful, failed };
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  emailTemplates
};
