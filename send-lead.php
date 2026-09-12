<?php
/**
 * Lead capture handler for the "Get Your Free Consultation" popup.
 * Accepts POST (name, email, phone, interest, message), validates,
 * emails the lead to the team, returns JSON.
 */

header('Content-Type: application/json');

function fail($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

// ---------------------------------------------------------------
// Origin/Referer check. Server-side processing ignores CORS (CORS only
// restricts whether JS can *read* the response, not whether the request is
// accepted) so without this, any third-party page can POST here directly —
// and since a successful submission triggers a real auto-reply email to
// whatever address is submitted, that's a spam/abuse vector for our own
// sending domain, not just a data-integrity concern.
// ---------------------------------------------------------------
function request_host_allowed($allowedHost) {
    $source = '';
    if (!empty($_SERVER['HTTP_ORIGIN'])) {
        $source = $_SERVER['HTTP_ORIGIN'];
    } elseif (!empty($_SERVER['HTTP_REFERER'])) {
        $source = $_SERVER['HTTP_REFERER'];
    } else {
        // Neither header present (privacy browser/extension stripped them,
        // or a non-browser client) — fail OPEN. This is a real production
        // lead form; silently dropping genuine leads over a missing header
        // is worse than the abuse case this check is narrowing. The rate
        // limiter below still applies regardless.
        return true;
    }
    $host = parse_url($source, PHP_URL_HOST);
    if (!$host) return true; // unparseable header — don't block on ambiguity
    return $host === $allowedHost || substr($host, -strlen('.' . $allowedHost)) === '.' . $allowedHost;
}

if (!request_host_allowed('hahealthconsulting.com')) {
    fail('Request origin not allowed.', 403);
}

// ---------------------------------------------------------------
// Simple file-based rate limit: max 5 submissions per IP per hour. The
// honeypot below stops naive bots but is trivially bypassed by anyone who
// reads the page source, so this is the actual throttle against abuse.
// ---------------------------------------------------------------
function is_rate_limited($ip, $maxPerWindow = 5, $windowSeconds = 3600) {
    $dir = sys_get_temp_dir() . '/ha_lead_throttle';
    if (!is_dir($dir)) { @mkdir($dir, 0700, true); }
    if (!is_dir($dir) || !is_writable($dir)) return false; // fail open — never block real leads over a filesystem issue
    $safeIp = preg_replace('/[^a-zA-Z0-9_.:-]/', '_', (string) $ip);
    $file = $dir . '/' . $safeIp . '.json';
    $now = time();
    $entries = [];
    if (file_exists($file)) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (is_array($decoded)) $entries = $decoded;
    }
    $entries = array_values(array_filter($entries, function ($t) use ($now, $windowSeconds) {
        return is_numeric($t) && ($now - $t) < $windowSeconds;
    }));
    if (count($entries) >= $maxPerWindow) {
        return true;
    }
    $entries[] = $now;
    @file_put_contents($file, json_encode($entries));
    return false;
}

if (is_rate_limited($_SERVER['REMOTE_ADDR'] ?? '')) {
    fail('Too many requests. Please try again in a little while, or call us at (832) 800-4352.', 429);
}

// Honeypot: real visitors never fill this in. Bots that do get a fake
// success without an email actually being sent.
if (!empty($_POST['company_website'])) {
    echo json_encode(['success' => true]);
    exit;
}

function strip_header_injection($value) {
    return str_replace(["\r", "\n"], ' ', (string) $value);
}

function clean_field($key, $maxLength = 2000) {
    $value = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    // Strip anything that could inject extra mail headers.
    $value = strip_header_injection($value);
    return mb_substr($value, 0, $maxLength);
}

$name = clean_field('name', 200);
$email = clean_field('email', 200);
$phone = clean_field('phone', 50);
$interest = clean_field('interest', 200);
$message = clean_field('message', 2000);

if ($name === '' || $email === '' || $phone === '') {
    fail('Name, email, and phone are required.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}

// ---------------------------------------------------------------
// Rule-based lead scoring (deterministic, no external service).
// Helps staff triage which leads to call back first.
// ---------------------------------------------------------------
function score_lead($interest, $message) {
    $score = 0;

    // Higher-value / higher-intent service areas.
    $highValueInterests = ['Medical Billing & RCM', 'EHR Optimization', 'Compliance & Regulatory'];
    if (in_array($interest, $highValueInterests, true)) {
        $score += 2;
    } elseif ($interest !== '' && $interest !== 'Not sure yet') {
        $score += 1;
    }

    // A real, detailed message signals higher intent than a blank one.
    $messageLength = mb_strlen(trim($message));
    if ($messageLength >= 200) {
        $score += 2;
    } elseif ($messageLength >= 40) {
        $score += 1;
    }

    // Urgency language in the lead's own words.
    $urgentTerms = ['urgent', 'asap', 'as soon as possible', 'right away', 'immediately', 'this week', 'today'];
    $lowerMessage = mb_strtolower($message);
    foreach ($urgentTerms as $term) {
        if (mb_strpos($lowerMessage, $term) !== false) {
            $score += 2;
            break;
        }
    }

    // Multi-provider / multi-location practices are typically higher-value engagements.
    $scaleTerms = ['multiple locations', 'several providers', 'multi-location', 'practice group', 'health system'];
    foreach ($scaleTerms as $term) {
        if (mb_strpos($lowerMessage, $term) !== false) {
            $score += 1;
            break;
        }
    }

    if ($score >= 5) return ['label' => 'HOT', 'score' => $score];
    if ($score >= 3) return ['label' => 'WARM', 'score' => $score];
    return ['label' => 'STANDARD', 'score' => $score];
}

$leadScore = score_lead($interest, $message);

$to = 'info@hahealthconsulting.com';
$cc = 'mo@hahealthconsulting.com';
$subject = '[' . $leadScore['label'] . '] New Lead - H&A Healthcare Consulting Website';

$body = "New lead submitted through hahealthconsulting.com\n\n"
    . "Priority: {$leadScore['label']} (score {$leadScore['score']})\n\n"
    . "Name: {$name}\n"
    . "Email: {$email}\n"
    . "Phone: {$phone}\n"
    . "Area of interest: " . ($interest !== '' ? $interest : 'Not specified') . "\n"
    . "Message: " . ($message !== '' ? $message : '(none)') . "\n\n"
    . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
    . "Source page: " . (isset($_SERVER['HTTP_REFERER']) ? strip_header_injection($_SERVER['HTTP_REFERER']) : 'unknown') . "\n";

$replyToName = str_replace(['"', '<', '>'], '', $name);

$headers = [
    'From: H&A Healthcare Consulting Website <website@hahealthconsulting.com>',
    'Reply-To: "' . $replyToName . '" <' . $email . '>',
    'Cc: ' . $cc,
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = @mail($to, $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    // Without this, a broken mail() config on the server silently drops
    // leads with zero trace — the visitor sees a generic error, but nobody
    // on our side ever finds out unless they happen to be the one testing it.
    error_log('[send-lead.php] mail() failed for lead notification. Name: ' . $name . ', Email: ' . $email);
    fail('We could not send your message right now. Please call us at (832) 800-4352.', 502);
}

// ---------------------------------------------------------------
// Instant auto-reply to the lead, so they get an immediate response
// rather than waiting for a human to see the notification above.
// Failure to send this never fails the request — the staff notification
// above already succeeded, which is what matters most.
// ---------------------------------------------------------------
$autoReplySubject = 'Thanks for reaching out to H&A Healthcare Consulting';
$autoReplyBody = "Hi {$name},\n\n"
    . "Thanks for reaching out to H&A Healthcare Consulting"
    . ($interest !== '' && $interest !== 'Not sure yet' ? " about {$interest}" : '') . ". "
    . "We've received your request and someone from our team will be in touch shortly, usually within one business day.\n\n"
    . "If your request is time-sensitive, you can also reach us directly at (832) 800-4352.\n\n"
    . "Talk soon,\n"
    . "H&A Healthcare Consulting\n"
    . "20008 Champion Forest Dr #203, Spring, TX 77379\n";

$autoReplyHeaders = [
    'From: H&A Healthcare Consulting <info@hahealthconsulting.com>',
    'Content-Type: text/plain; charset=UTF-8',
];

@mail($email, $autoReplySubject, $autoReplyBody, implode("\r\n", $autoReplyHeaders));

echo json_encode(['success' => true]);
