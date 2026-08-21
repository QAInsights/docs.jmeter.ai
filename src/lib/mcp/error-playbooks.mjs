/**
 * Diagnostic Error Playbooks for JMeter & JVM runtime failures.
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   matchedKeywords: string[],
 *   rootCause: string,
 *   remediation: string[],
 *   configFixes?: Record<string, string>,
 *   docUrl: string
 * }} ErrorPlaybook
 */

/** @type {ErrorPlaybook[]} */
export const errorPlaybooks = [
  {
    id: 'bind-exception-address-in-use',
    title: 'java.net.BindException: Address already in use',
    matchedKeywords: ['bindexception', 'address already in use', 'ephemeral ports', 'port exhaustion', 'eaddrinuse'],
    rootCause: 'Ephemeral port exhaustion on the load generator machine due to rapid TCP connections sitting in TIME_WAIT state.',
    remediation: [
      'Enable HTTP Keep-Alive in HTTP Request Defaults to reuse TCP connections.',
      'Reduce TCP TIME_WAIT timeout and enable port reuse in Linux kernel: `sysctl -w net.ipv4.tcp_tw_reuse=1`.',
      'Expand ephemeral port range: `sysctl -w net.ipv4.ip_local_port_range="1024 65535"`.',
      'Distribute load across multiple worker engines if reaching > 60k requests/sec.',
    ],
    configFixes: {
      'sysctl.conf': 'net.ipv4.tcp_tw_reuse = 1\nnet.ipv4.ip_local_port_range = 1024 65535',
    },
    docUrl: 'https://docs.jmeter.ai/topics/errors/bind-exception-address-in-use/',
  },
  {
    id: 'out-of-memory-heap',
    title: 'java.lang.OutOfMemoryError: Java heap space',
    matchedKeywords: ['outofmemoryerror', 'heap space', 'heap oom', 'gc overhead limit exceeded'],
    rootCause: 'JMeter heap size is too small for the thread count, or active GUI listeners (View Results Tree) / View Results in Table are hoarding sample responses in RAM.',
    remediation: [
      'Disable or remove ALL GUI listeners (View Results Tree, Aggregate Graph) from the test plan.',
      'Increase heap allocation in `bin/jmeter` or JVM environment: `HEAP="-Xms4g -Xmx4g -XX:+UseG1GC"`.',
      'Disable response data saving in JTL properties: `jmeter.save.saveservice.response_data=false`.',
      'Run exclusively in CLI mode: `jmeter -n -t test.jmx -l results.jtl`.',
    ],
    configFixes: {
      'user.properties': 'jmeter.save.saveservice.response_data=false\njmeter.save.saveservice.samplerData=false',
      'env': 'JVM_ARGS="-Xms4g -Xmx4g -XX:+UseG1GC"',
    },
    docUrl: 'https://docs.jmeter.ai/topics/errors/out-of-memory-heap/',
  },
  {
    id: 'socket-timeout-exception',
    title: 'java.net.SocketTimeoutException: Read timed out / Connect timed out',
    matchedKeywords: ['sockettimeoutexception', 'read timed out', 'connect timed out', 'timeout'],
    rootCause: 'Target backend or network gateway failed to accept connection or return response bytes within the configured timeout window.',
    remediation: [
      'Check backend server CPU, thread pool saturation, and database connection pool locks.',
      'Increase response timeout in HTTP Request Defaults (e.g., 30000ms) to measure latency tail without prematurely dropping connections.',
      'Inspect load balancer / reverse proxy timeouts (Nginx `proxy_read_timeout`, AWS ALB 60s idle timeout).',
    ],
    docUrl: 'https://docs.jmeter.ai/topics/errors/socket-timeout-exception/',
  },
  {
    id: 'no-http-response-exception',
    title: 'org.apache.http.NoHttpResponseException: The target server failed to respond',
    matchedKeywords: ['nohttpresponseexception', 'failed to respond', 'stale connection', 'keepalive drop'],
    rootCause: 'Target server or proxy closed an idle persistent (Keep-Alive) connection right as JMeter sent a new request over it (race condition).',
    remediation: [
      'Set `httpclient4.validate_after_inactivity=2000` or `1000` in `user.properties` so JMeter verifies idle connections before sending.',
      'Tune `httpclient4.idletimeout=10000` to match or be slightly lower than backend server KeepAliveTimeout.',
      'Ensure server KeepAlive timeout is known (e.g. Apache/Nginx keepalive_timeout).',
    ],
    configFixes: {
      'user.properties': 'httpclient4.validate_after_inactivity=2000\nhttpclient4.idletimeout=10000',
    },
    docUrl: 'https://docs.jmeter.ai/topics/errors/no-http-response-exception/',
  },
  {
    id: 'ssl-handshake-exception',
    title: 'javax.net.ssl.SSLHandshakeException / SSLPeerUnverifiedException',
    matchedKeywords: ['sslhandshakeexception', 'sslpeerunverifiedexception', 'handshake failure', 'certificate', 'tls'],
    rootCause: 'TLS version mismatch, untrusted self-signed certificate, missing client certificate in keystore, or SNI host header mismatch.',
    remediation: [
      'If using self-signed or internal CA certs in lab, configure truststore via `-Djavax.net.ssl.trustStore=path/to/truststore.jks`.',
      'For client mTLS certificates, configure Keystore Configuration element in JMeter.',
      'Verify target supports TLS 1.2 or TLS 1.3 (`https.socket.protocols=TLSv1.2,TLSv1.3`).',
    ],
    docUrl: 'https://docs.jmeter.ai/topics/errors/ssl-handshake-exception/',
  },
  {
    id: 'too-many-open-files-ulimit',
    title: 'java.io.IOException: Too many open files',
    matchedKeywords: ['too many open files', 'ulimit', 'file descriptor exhaustion', 'nofile'],
    rootCause: 'OS file descriptor limit (`ulimit -n`) reached by concurrent sockets, result loggers, or CSV readers.',
    remediation: [
      'Increase OS open file limits in `/etc/security/limits.conf`: `* soft nofile 65535` and `* hard nofile 65535`.',
      'Check current limit: `ulimit -n`. Apply for current session: `ulimit -n 65535`.',
      'In systemd services or Docker containers, set `LimitNOFILE=65535`.',
    ],
    configFixes: {
      '/etc/security/limits.conf': '* soft nofile 65535\n* hard nofile 65535',
    },
    docUrl: 'https://docs.jmeter.ai/topics/errors/too-many-open-files-ulimit/',
  },
  {
    id: '401-403-after-recording',
    title: 'HTTP 401 Unauthorized / 403 Forbidden after Recording',
    matchedKeywords: ['401 unauthorized', '403 forbidden', 'recording failed', 'csrf', 'session expired', 'token invalid'],
    rootCause: 'Hardcoded dynamic tokens (CSRF, anti-forgery, OAuth bearer tokens, JSESSIONID) captured during browser recording have expired or mismatch session state.',
    remediation: [
      'Add an HTTP Cookie Manager at the top of the Test Plan (leaves default options to handle session cookies).',
      'Add a JSON Extractor or Regular Expression Extractor after the login/auth step to dynamically capture the token into a variable (e.g. `authToken`).',
      'Replace hardcoded tokens in subsequent requests with `Bearer ${authToken}` or `${csrf_token}`.',
    ],
    docUrl: 'https://docs.jmeter.ai/topics/errors/401-403-after-recording/',
  },
];

/**
 * Find matching error playbooks.
 * @param {string} query
 * @returns {ErrorPlaybook[]}
 */
export function lookupErrorPlaybook(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return errorPlaybooks;
  return errorPlaybooks.filter(
    (p) =>
      p.id.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.rootCause.toLowerCase().includes(q) ||
      p.matchedKeywords.some((k) => q.includes(k) || k.includes(q)),
  );
}
