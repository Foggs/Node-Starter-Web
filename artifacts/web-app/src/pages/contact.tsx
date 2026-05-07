import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Mail, Clock, Loader2, AlertTriangle } from "lucide-react";
import { useSubmitContact } from "@workspace/api-client-react";
import { SOCIAL_LINKS } from "@/data/footerLinks";
import { SocialIconButton, FOCUS_RING } from "@/components/SocialIconButton";
import { EMAIL_RE, EMAIL_MAX_LENGTH } from "@/lib/validation";
import { categorizeApiError } from "@/lib/apiErrors";

// TODO: replace before launch — client to confirm real address.
const CONTACT_EMAIL = "hello@exitcoach.app";

const NAME_MIN = 2;
const NAME_MAX = 100;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const COUNTER_THRESHOLD = 1500;
const MIN_LOADER_MS = 300;

const FIELD_LABEL = "block text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A9BB5] mb-2";
const FIELD_INPUT =
  "w-full rounded-lg bg-white/[0.06] border border-white/[0.14] px-3.5 py-2.5 text-[14px] text-[#C8D4E3] " +
  "placeholder:text-[#5A6B82] transition-colors " +
  "focus:outline-none focus:border-[#F5B730] focus:ring-0 " +
  "aria-[invalid=true]:border-[#F09595]";
const FIELD_ERROR = "mt-1.5 text-[12px] text-[#F09595]";

interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

function validateAll(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = {};
  const nameTrim = name.trim();
  const emailTrim = email.trim();
  const messageTrim = message.trim();

  if (nameTrim.length < NAME_MIN) {
    errors.name = `Please enter your name (at least ${NAME_MIN} characters).`;
  } else if (nameTrim.length > NAME_MAX) {
    errors.name = `Name is too long (max ${NAME_MAX} characters).`;
  }

  if (emailTrim.length === 0) {
    errors.email = "Please enter your email address.";
  } else if (emailTrim.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(emailTrim)) {
    errors.email = "Please enter a valid email address.";
  }

  if (messageTrim.length < MESSAGE_MIN) {
    errors.message = `Message is a little short — please write at least ${MESSAGE_MIN} characters.`;
  } else if (messageTrim.length > MESSAGE_MAX) {
    errors.message = `Message is too long (max ${MESSAGE_MAX} characters).`;
  }

  return errors;
}

export default function Contact() {
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<{ name: boolean; email: boolean; message: boolean }>({
    name: false,
    email: false,
    message: false,
  });
  const submitStartRef = useRef<number | null>(null);
  const [showLoader, setShowLoader] = useState(false);

  const fieldErrors = validateAll(name, email, message);
  const isFormValid =
    !fieldErrors.name && !fieldErrors.email && !fieldErrors.message;

  const mutation = useSubmitContact({
    mutation: {
      onSuccess: () => {
        const elapsed = submitStartRef.current
          ? Date.now() - submitStartRef.current
          : 0;
        const wait = Math.max(0, MIN_LOADER_MS - elapsed);
        window.setTimeout(() => {
          setShowLoader(false);
          navigate("/thank-you");
        }, wait);
      },
      onError: () => {
        const elapsed = submitStartRef.current
          ? Date.now() - submitStartRef.current
          : 0;
        const wait = Math.max(0, MIN_LOADER_MS - elapsed);
        window.setTimeout(() => setShowLoader(false), wait);
      },
    },
  });

  const apiError = mutation.isError
    ? categorizeApiError(mutation.error, "Sending your message")
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    if (!isFormValid || mutation.isPending || showLoader) return;

    submitStartRef.current = Date.now();
    setShowLoader(true);
    mutation.mutate({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
      },
    });
  }

  const messageLength = message.length;
  const showCounter = messageLength >= COUNTER_THRESHOLD;
  const isSubmitting = showLoader || mutation.isPending;
  const submitDisabled = !isFormValid || isSubmitting;

  return (
    <main
      aria-label="Contact page"
      className="min-h-screen bg-[#1B2A4A] text-[#C8D4E3]"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 pt-14 pb-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Get in touch
        </h1>
        <p className="mt-3 text-[15px] text-[#8A9BB5] max-w-[600px]">
          Whether you're a manager, an HR leader, or just curious — we'd love
          to hear from you.
        </p>
      </div>

      <div className="border-t border-white/[0.08]" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
        <ConnectColumn />
        <div className="lg:border-l lg:border-white/[0.08] lg:pl-14">
          <form noValidate onSubmit={handleSubmit} className="max-w-[560px]">
            {apiError && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-lg border border-[#F09595]/40 bg-[#F09595]/10 px-3.5 py-3 text-sm"
              >
                <AlertTriangle
                  className="w-4 h-4 mt-0.5 shrink-0 text-[#F09595]"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{apiError.title}</p>
                  <p className="mt-0.5 text-[#C8D4E3]">{apiError.body}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="contact-name" className={FIELD_LABEL}>
                Full name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                aria-invalid={touched.name && !!fieldErrors.name}
                aria-describedby={
                  touched.name && fieldErrors.name ? "contact-name-error" : undefined
                }
                className={FIELD_INPUT}
                placeholder="Jane Doe"
              />
              {touched.name && fieldErrors.name && (
                <p id="contact-name-error" className={FIELD_ERROR}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="mt-5">
              <label htmlFor="contact-email" className={FIELD_LABEL}>
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-invalid={touched.email && !!fieldErrors.email}
                aria-describedby={
                  touched.email && fieldErrors.email ? "contact-email-error" : undefined
                }
                className={FIELD_INPUT}
                placeholder="you@example.com"
              />
              {touched.email && fieldErrors.email && (
                <p id="contact-email-error" className={FIELD_ERROR}>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="mt-5">
              <label htmlFor="contact-message" className={FIELD_LABEL}>
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                maxLength={MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                aria-invalid={touched.message && !!fieldErrors.message}
                aria-describedby={
                  touched.message && fieldErrors.message
                    ? "contact-message-error"
                    : undefined
                }
                className={`${FIELD_INPUT} h-[110px] resize-none leading-relaxed`}
                placeholder="Tell us about your team, your role, or what brought you here."
              />
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {touched.message && fieldErrors.message && (
                    <p id="contact-message-error" className={FIELD_ERROR}>
                      {fieldErrors.message}
                    </p>
                  )}
                </div>
                {showCounter && (
                  <span
                    aria-live="polite"
                    className="text-[12px] text-[#5A6B82] tabular-nums shrink-0"
                  >
                    {messageLength} / {MESSAGE_MAX}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              aria-disabled={submitDisabled}
              aria-busy={isSubmitting}
              onClick={(e) => {
                if (submitDisabled) e.preventDefault();
              }}
              className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg
                          bg-[#F5B730] px-7 py-2.5 text-[14px] font-semibold text-[#1B2A4A]
                          transition-opacity hover:opacity-90 ${FOCUS_RING}
                          ${submitDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>Send message →</>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function ConnectColumn() {
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8A9BB5]">
        Connect
      </h2>

      <div className="mt-5 space-y-4">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={`group inline-flex items-center gap-3 text-[15px] text-[#C8D4E3] hover:text-amber-400 transition-colors ${FOCUS_RING}`}
        >
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-amber-400/10"
            aria-hidden="true"
          >
            <Mail className="w-4 h-4 text-[#F5B730]" />
          </span>
          {CONTACT_EMAIL}
        </a>

        <div className="flex items-center gap-3 text-[14px] text-[#C8D4E3]">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-amber-400/10"
            aria-hidden="true"
          >
            <Clock className="w-4 h-4 text-[#F5B730]" />
          </span>
          We read every message
        </div>
      </div>

      <ul role="list" className="mt-7 flex flex-wrap gap-3">
        {SOCIAL_LINKS.map((social) => (
          <li key={social.label}>
            <SocialIconButton
              label={social.label}
              href={social.href}
              icon={social.icon}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
