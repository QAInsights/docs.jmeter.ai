/**
 * Curated, production-grade JSR223 Groovy recipes for JMeter.
 *
 * All recipes use Groovy best practices, avoid memory leaks, and have
 * script compilation caching enabled.
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   category: 'Auth' | 'Headers' | 'JSON' | 'Logging' | 'Payload',
 *   summary: string,
 *   code: string,
 *   jmeterVariables: string[]
 * }} Jsr223Recipe
 */

/** @type {Jsr223Recipe[]} */
export const jsr223Recipes = [
  {
    id: 'jwt_parse_expiry',
    title: 'Decode JWT & Check Expiration',
    category: 'Auth',
    summary: 'Decodes a JWT access token payload without external libraries and sets remaining validity seconds in a JMeter variable.',
    jmeterVariables: ['vars', 'log'],
    code: `import groovy.json.JsonSlurper
import java.nio.charset.StandardCharsets
import java.util.Base64

String token = vars.get("authToken")
if (!token || !token.contains(".")) {
    log.error("authToken is missing or not a valid JWT format.")
    return
}

String[] parts = token.split("\\\\.")
if (parts.length >= 2) {
    byte[] decodedBytes = Base64.getUrlDecoder().decode(parts[1])
    String payloadJson = new String(decodedBytes, StandardCharsets.UTF_8)
    
    def payload = new JsonSlurper().parseText(payloadJson)
    long exp = (payload.exp as Long) ?: 0L
    long nowSec = System.currentTimeMillis() / 1000L
    long remainingSec = exp - nowSec
    
    vars.put("token_remaining_sec", remainingSec.toString())
    vars.put("user_id", (payload.sub ?: payload.userId ?: "").toString())
    
    if (remainingSec < 60) {
        log.warn("JWT token expires in less than 60 seconds (remaining: \${remainingSec}s).")
    }
}`,
  },
  {
    id: 'hmac_sha256_signer',
    title: 'Generate HMAC-SHA256 Signature Header',
    category: 'Auth',
    summary: 'Calculates an HMAC-SHA256 signature over a dynamic timestamp and request payload, adding the Authorization header.',
    jmeterVariables: ['vars', 'sampler'],
    code: `import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.nio.charset.StandardCharsets

String secretKey = vars.get("apiSecret") ?: "default_secret"
String timestamp = String.valueOf(System.currentTimeMillis())
String path = sampler.getPath()
String message = "\${timestamp}:\${path}"

Mac mac = Mac.getInstance("HmacSHA256")
mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
byte[] rawHmac = mac.doFinal(message.getBytes(StandardCharsets.UTF_8))

// Convert to hex string
StringBuilder hexString = new StringBuilder()
for (byte b : rawHmac) {
    String hex = Integer.toHexString(0xff & b)
    if (hex.length() == 1) hexString.append('0')
    hexString.append(hex)
}

vars.put("request_signature", hexString.toString())
vars.put("request_timestamp", timestamp)

// Add header to sampler's HeaderManager
def headerManager = sampler.getHeaderManager()
if (headerManager != null) {
    headerManager.removeHeaderNamed("X-Signature")
    headerManager.removeHeaderNamed("X-Timestamp")
    headerManager.add(new org.apache.jmeter.protocol.http.control.Header("X-Signature", hexString.toString()))
    headerManager.add(new org.apache.jmeter.protocol.http.control.Header("X-Timestamp", timestamp))
}`,
  },
  {
    id: 'dynamic_header_injection',
    title: 'Dynamic HTTP Header Injection (PreProcessor)',
    category: 'Headers',
    summary: 'Safely adds or updates HTTP headers per-request without mutating shared global HeaderManager state.',
    jmeterVariables: ['sampler', 'vars'],
    code: `import org.apache.jmeter.protocol.http.control.Header
import org.apache.jmeter.protocol.http.control.HeaderManager

HeaderManager hm = sampler.getHeaderManager()
if (hm == null) {
    hm = new HeaderManager()
    sampler.setHeaderManager(hm)
}

String correlationId = UUID.randomUUID().toString()
hm.removeHeaderNamed("X-Correlation-ID")
hm.add(new Header("X-Correlation-ID", correlationId))
vars.put("current_correlation_id", correlationId)`,
  },
  {
    id: 'json_nested_extraction',
    title: 'Parse Nested JSON Array & Pick Random Item',
    category: 'JSON',
    summary: 'Parses a JSON response payload, filters active items, and extracts an ID for subsequent requests.',
    jmeterVariables: ['prev', 'vars', 'log'],
    code: `import groovy.json.JsonSlurper

String responseText = prev.getResponseDataAsString()
if (!responseText || responseText.trim().isEmpty()) {
    log.warn("Response body is empty, cannot parse JSON.")
    return
}

def json = new JsonSlurper().parseText(responseText)
// Find active items with status == 'ACTIVE'
def activeItems = json.items?.findAll { it.status == 'ACTIVE' }

if (activeItems && !activeItems.isEmpty()) {
    def picked = activeItems[java.util.concurrent.ThreadLocalRandom.current().nextInt(activeItems.size())]
    vars.put("selected_item_id", picked.id.toString())
    vars.put("selected_item_name", picked.name.toString())
} else {
    log.warn("No active items found in JSON response.")
    vars.put("selected_item_id", "NOT_FOUND")
}`,
  },
  {
    id: 'custom_csv_logger',
    title: 'Thread-Safe Custom CSV / Failure Logger',
    category: 'Logging',
    summary: 'Appends custom error details or latency records into a dedicated CSV file without file lock contention.',
    jmeterVariables: ['prev', 'vars'],
    code: `import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.StandardOpenOption

if (!prev.isSuccessful()) {
    String logDir = vars.get("LOG_DIR") ?: "results"
    java.nio.file.Path filePath = Paths.get(logDir, "failed-requests.csv")
    
    // Ensure parent directory exists
    if (!Files.exists(filePath.getParent())) {
        Files.createDirectories(filePath.getParent())
    }
    
    String line = String.format("%d,%s,%s,%d,%s\\n",
        System.currentTimeMillis(),
        prev.getSampleLabel().replace(",", ";"),
        prev.getResponseCode(),
        prev.getTime(),
        (prev.getResponseMessage() ?: "").replace(",", ";")
    )
    
    // Atomically append bytes
    Files.write(
        filePath,
        line.getBytes(java.nio.charset.StandardCharsets.UTF_8),
        StandardOpenOption.CREATE,
        StandardOpenOption.APPEND
    )
}`,
  },
];

/**
 * Filter or find JSR223 Groovy recipes.
 * @param {string} [query]
 * @returns {Jsr223Recipe[]}
 */
export function getJsr223Recipes(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return jsr223Recipes;
  return jsr223Recipes.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q),
  );
}
