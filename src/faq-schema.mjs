/**
 * Curated FAQ Q&A pairs for pages with natural Q&A content.
 * Used by SeoHead.astro to inject FAQPage JSON-LD structured data,
 * which can trigger expandable rich results in search engines.
 *
 * Answers are plain text (no markdown) per JSON-LD spec.
 * Keyed by pathname (without trailing slash, matching Astro.url.pathname).
 */
export const faqSchema = {
  // --- Glossary: term definitions framed as questions ---
  '/user-manual/glossary': [
    {
      q: 'What is elapsed time in JMeter?',
      a: 'JMeter measures the elapsed time from just before sending the request to just after the last response has been received. It does not include the time needed to render the response, nor does JMeter process any client code such as JavaScript.',
    },
    {
      q: 'What is latency in JMeter?',
      a: 'JMeter measures latency from just before sending the request to just after the first response has been received. This includes all processing needed to assemble the request and assemble the first part of the response. The JMeter latency time should be closer to that experienced by a browser or other application client than protocol analyser times.',
    },
    {
      q: 'What is connect time in JMeter?',
      a: 'JMeter measures the time it took to establish the connection, including the SSL handshake. Connect time is not automatically subtracted from latency. In case of connection error, the metric equals the time it took to encounter the error, such as a connection timeout. As of JMeter 3.1, this metric is only computed for TCP Sampler, HTTP Request, and JDBC Request.',
    },
    {
      q: 'What is the median in JMeter?',
      a: 'The median is a number which divides the samples into two equal halves. Half of the samples are smaller than the median, and half are larger. It is a standard statistical measure, the same as the 50th percentile.',
    },
    {
      q: 'What is a percentile in JMeter?',
      a: 'A percentile is the value below which 90% of the samples fall. The remaining samples take at least as long as the value. It is a standard statistical measure.',
    },
    {
      q: 'What is standard deviation in JMeter?',
      a: 'Standard deviation is a measure of the variability of a data set. JMeter calculates the population standard deviation (e.g. STDEVP function in spreadsheets), not the sample standard deviation (e.g. STDEV).',
    },
    {
      q: 'What is throughput in JMeter?',
      a: 'Throughput is calculated as requests per unit of time. The time is calculated from the start of the first sample to the end of the last sample, including any intervals between samples, as it is supposed to represent the load on the server. The formula is: Throughput = number of requests divided by total time.',
    },
  ],

  // --- Hints and Tips: practical how-to questions ---
  '/user-manual/hints-and-tips': [
    {
      q: 'How do I pass variables between threads in JMeter?',
      a: 'JMeter variables have thread scope by design so threads can act independently. To pass variables between threads, use a property instead  -  properties are shared between all JMeter threads. If one thread sets a property, another thread can read the updated value. For large amounts of information, consider using a file or a CSV Dataset.',
    },
    {
      q: 'How do I enable debug logging in JMeter?',
      a: 'Most test elements include debug logging. In the GUI, select the test element and use the Help Menu to enable or disable logging. To view log messages directly in the JMeter GUI, use the Options menu and select Log Viewer, or click the Warning icon in the upper right corner. You can enable the log console by setting jmeter.loggerpanel.display=true in jmeter.properties.',
    },
    {
      q: 'How do I search for variables or URLs in a JMeter test plan?',
      a: 'Since JMeter 2.6, you can search in a Test Plan tree for elements using a variable or containing a certain URL or parameter via the Menu Search feature. It supports case-sensitive search and regular expression matching.',
    },
    {
      q: 'How do I use JMeter on a HiDPI screen?',
      a: 'With Java 9 and up, HiDPI screens are supported. You can set the sun.java2d.uiScale Java property to change the scale. With Java 8, you can improve the display by setting jmeter.hidpi.mode=true, jmeter.hidpi.scale.factor=2.0, and increasing icon and font sizes via jmeter.properties.',
    },
    {
      q: 'How do I configure autosave backups in JMeter?',
      a: 'Since JMeter 3.0, JMeter automatically saves up to ten backups of every saved jmx file to the backups subfolder. You can control this via user.properties: set jmeter.gui.action.save.backup_on_save to false to disable, change the backup directory with jmeter.gui.action.save.backup_directory, and control retention with keep_backup_max_hours and keep_backup_max_count.',
    },
    {
      q: 'What are the keyboard shortcuts to add elements in JMeter?',
      a: 'JMeter provides keyboard shortcuts to quickly add elements: Ctrl+0 for Thread Group, Ctrl+1 for HTTP Request, Ctrl+2 for Regular Expression Extractor, Ctrl+3 for Response Assertion, Ctrl+4 for Constant Timer, Ctrl+5 for Test Action, Ctrl+6 for JSR223 PostProcessor, Ctrl+7 for JSR223 PreProcessor, Ctrl+8 for Debug Sampler, and Ctrl+9 for View Results Tree. These bindings are for Windows QWERTY keyboards; adapt for other platforms.',
    },
    {
      q: 'Why is the Browser renderer not displaying in View Results Tree?',
      a: 'If you are using OpenJDK or Oracle Java version higher than 8, the Browser Renderer is not displayed because JavaFX is not embedded. You need to install JavaFX for your OS and Java version, then configure the PATH_TO_FX variable and add the javafx.web and javafx.swing modules to the JAVA9_OPTS variable in the JMeter launch script.',
    },
  ],

  // --- Best Practices: practice-oriented questions ---
  '/user-manual/best-practices': [
    {
      q: 'Why should I always use the latest version of JMeter?',
      a: 'JMeter performance is constantly improved, so users are highly encouraged to use the most up to date version. You should avoid using versions older than three versions before the last one. Always read the changes list to be aware of new improvements and components.',
    },
    {
      q: 'How many threads should I use in JMeter?',
      a: 'The number of threads depends on your hardware capabilities and Test Plan design, as well as how fast your server is. If you do not correctly size the number of threads, you will face the Coordinated Omission problem which gives wrong or inaccurate results. For large-scale load testing, consider running multiple CLI JMeter instances on multiple machines using distributed mode.',
    },
    {
      q: 'How do I use the HTTP(S) Test Script Recorder in JMeter?',
      a: 'Filter out all requests you are not interested in, such as image requests. Use Include and Exclude Patterns to control what is recorded. The recorder expects a ThreadGroup element with a Recording Controller under it. You can abstract common elements by defining user-defined variables at the Test Plan level to have JMeter automatically replace values in recorded samples.',
    },
    {
      q: 'How do I use user variables in JMeter test plans?',
      a: 'Create a text file containing user names and passwords separated by commas, add a CSV DataSet configuration element to the test plan, and name the variables such as USER and PASS. Replace the login name and password with the variable references on the appropriate samplers. The CSV Data Set element reads a new line for each thread.',
    },
    {
      q: 'How do I reduce JMeter resource requirements?',
      a: 'Use CLI mode, use as few Listeners as possible, avoid View Results Tree or Table listeners during load tests, use the same sampler in a loop with variables instead of many similar samplers, use CSV output rather than XML, only save the data you need, use as few Assertions as possible, and use the most performing scripting language such as JSR223 with Groovy.',
    },
    {
      q: 'How do I parameterise JMeter tests?',
      a: 'Define variables on the Test Plan and reference them in test elements. For CLI mode, define Test Plan variables in terms of properties using the __P function, then override them on the command line with the -J flag. For many properties, use property files and pass them with the -q command-line option.',
    },
    {
      q: 'What scripting language should I use for JMeter load testing?',
      a: 'For intensive load testing, use a scripting language whose ScriptingEngine implements the Compilable interface, such as Apache Groovy via JSR223 elements. Avoid BeanShell and JavaScript for intensive load testing as they do not implement Compilable properly. Enable the Cache compiled script option and use vars.get() instead of ${varName} to avoid caching issues.',
    },
    {
      q: 'How do I share variables between threads and thread groups in JMeter?',
      a: 'Variables are local to a thread by design. For values known before a test starts, use parameterised tests with properties. For values not known until the test starts, store the variable as a property (which is global to the JMeter instance), write variables to a file and re-read them, use the bsh.shared namespace, or write your own Java classes.',
    },
    {
      q: 'How should I manage JMeter properties?',
      a: 'Never modify jmeter.properties directly. Instead, copy the property from jmeter.properties and modify its value in user.properties. This eases migration to the next version of JMeter. The user.properties file supersedes properties defined in jmeter.properties.',
    },
  ],

  '/tools/thread-calculator': [
    {
      q: 'How many threads do I need in JMeter for a target RPS?',
      a: 'As a first estimate with no think time, threads are approximately target RPS multiplied by average response time in seconds. For example, 50 RPS at 200 ms average response time needs about 10 concurrent threads. Always validate with a pilot run because real response times rise under load.',
    },
    {
      q: 'What is the formula for JMeter thread group sizing?',
      a: 'Use concurrency approximately equal to arrival rate times service time. In JMeter terms: threads approximately equals ceil of target RPS times response time in milliseconds divided by 1000. Add think time, ramp-up, and client limits on top of that estimate.',
    },
    {
      q: 'How long should JMeter ramp-up be?',
      a: 'A common starting point is about one second of ramp-up per thread so load increases gradually. Very short ramp-ups create a thundering herd that spikes errors and distorts early samples. Adjust after you see injector and server CPU during a pilot.',
    },
    {
      q: 'Why is my JMeter throughput lower than the calculator estimate?',
      a: 'The calculator assumes busy threads with no think time and a stable response time. Lower throughput usually means response time grew under load, the injector CPU or listeners are saturated, think time is present, or the server is throttling. Re-measure average response time under load and resize.',
    },
  ],

   '/tools/coordinated-omission': [
     {
       q: 'What is coordinated omission in JMeter?',
       a: 'Coordinated omission is a measurement bias that occurs when a load generator schedules the next request at a fixed interval but fails to account for the time already spent waiting on the previous request. When the server degrades, threads get stuck, fewer requests are sent than the target rate, and the missing requests are silently dropped instead of queued. This produces artificially low response times and inflated percentiles.',
     },
     {
       q: 'How do I calculate the coordinated omission correction factor?',
       a: 'The correction factor is target RPS divided by actual RPS. For example, if you targeted 50 RPS but only achieved 20 RPS, the correction factor is 2.5x, meaning your real response time is roughly 2.5 times what JMeter reported. A factor above 1.25 indicates significant skew.',
     },
     {
       q: 'How many requests are lost to coordinated omission?',
       a: 'Lost requests equal target RPS minus actual RPS, multiplied by the test duration in seconds. For example, targeting 50 RPS but achieving 20 RPS over 60 seconds means 1,800 requests were silently dropped.',
     },
     {
       q: 'How do I fix coordinated omission in JMeter?',
       a: 'Use more threads so throughput stays at or above the target rate. The Thread Calculator can help you size threads correctly: threads approximately equals target RPS multiplied by average response time in seconds. Alternatively, lower your target RPS or use a proper load generation tool that handles queuing.',
     },
     {
       q: 'Does JMeter have a built-in coordinated omission fix?',
       a: 'JMeter does not automatically correct for coordinated omission in its standard Thread Group. The constant throughput timer helps maintain a target rate but does not queue or correct dropped requests. For accurate latency measurement, use HdrHistogram-based plugins or the Throughput Shaping Timer.',
     },
   ],

   '/tools/heap-estimator': [
    {
      q: 'How much heap memory does JMeter need?',
      a: 'It depends on threads, samplers, scripting, listeners, and response size. A rough starting point is several hundred megabytes of base overhead plus about one megabyte per concurrent thread on the injector, then validate with GC logs. Prefer CLI mode and disable View Results Tree during load.',
    },
    {
      q: 'How do I set JMeter Xmx heap size?',
      a: 'Set JVM heap via JVM_ARGS or the HEAP environment variable used by JMeter startup scripts, for example -Xms512m -Xmx2048m, then restart JMeter. Size each distributed engine for its share of threads rather than only the controller.',
    },
  ],

  '/tools/regex-tester': [
    {
      q: 'How do JMeter regex extractor templates like $1$ work?',
      a: 'Parentheses in the regular expression create capture groups. The template field can reference those groups as $1$, $2$, and so on, or $0$ for the full match. Match No. selects which occurrence to use when the pattern matches multiple times.',
    },
    {
      q: 'Should I use regex or JSON Extractor in JMeter?',
      a: 'For JSON responses, prefer JSON Extractor or JMESPath when possible because they understand structure better than brittle regular expressions. Use regular expressions for HTML snippets, tokens in free text, or protocols without a dedicated extractor.',
    },
    {
      q: 'Does the Regex Extractor Builder upload my response body?',
      a: 'No. The builder runs entirely in your browser. The pasted response is analyzed locally and is not uploaded to any server. Maximum paste size is 1 MB so the page stays responsive.',
    },
    {
      q: 'How do I extract a CSRF or access token with JMeter Regular Expression Extractor?',
      a: 'Paste a sample response into the Regex Extractor Builder, pick the token candidate, then copy Name of created variable, Regular Expression, Template $1$, Match No. 1, and a Default Value such as NOT_FOUND into a Regular Expression Extractor under the sampler that returns that body.',
    },
  ],

  // --- Topic guides (money pages) ---
  '/topics/api-load-testing': [
    {
      q: 'Can JMeter load test REST APIs?',
      a: 'Yes. Use the HTTP Request sampler with the appropriate method, path, headers, and body. REST is not a separate sampler type; it is HTTP with JSON or XML payloads and status conventions.',
    },
    {
      q: 'Does JMeter run JavaScript in API responses?',
      a: 'No. JMeter does not render pages or run browser JavaScript. It records protocol-level timings for the requests it sends. Client-side rendering cost is out of scope unless you use a real-browser tool alongside JMeter.',
    },
    {
      q: 'Should I record APIs with the HTTP(S) Test Script Recorder?',
      a: 'You can record browser or proxy traffic, then delete static assets and parameterize. Many API teams prefer building HTTP samplers directly or importing curl commands. If you record, use include and exclude patterns so the plan stays maintainable.',
    },
    {
      q: 'How do I pass an Authorization bearer token in JMeter?',
      a: 'Extract the token from the login response into a variable, then set the Authorization header to Bearer plus that variable via an HTTP Header Manager. Keep the token thread-local unless you intentionally share it via properties.',
    },
    {
      q: 'How many threads do I need for a JMeter API test?',
      a: 'It depends on target throughput, response time, think time, and injector capacity. Start from requests per second times service time in seconds, validate with a pilot, and re-measure under load. Incorrect sizing contributes to coordinated omission.',
    },
    {
      q: 'Why is JMeter API throughput lower than expected?',
      a: 'Common causes include server saturation as response times rise, injector limits, listeners left enabled, think time or timers, assertion cost, connection limits, or too few threads. Compare achieved hits per second on the dashboard with active threads and error rate.',
    },
    {
      q: 'Should I use GUI or non-GUI mode for real API load runs?',
      a: 'Use non-GUI mode. Official best practices recommend CLI mode for load and the GUI for building and debugging only.',
    },
    {
      q: 'How do I parameterize host and thread count for API tests?',
      a: 'Define values with the __P function and optional defaults, for example threads equals __P of threads with default 10, then override on the command line with -Jthreads and -Jhost when running jmeter -n.',
    },
  ],

  '/topics/ci-cd-load-testing': [
    {
      q: 'Can I run the JMeter GUI in CI?',
      a: 'You should not. Official guidance is to use non-GUI mode for load tests. GUI mode wastes resources, is fragile on headless agents, and can hang without a display.',
    },
    {
      q: 'What is the minimum JMeter CLI command for pipelines?',
      a: 'jmeter -n -t plan.jmx -l results.jtl runs the test and writes results. Add -e -o report/ to generate the HTML dashboard as a build artifact. The report output directory should be clean for each run.',
    },
    {
      q: 'How do I change JMeter thread count without editing the JMX in CI?',
      a: 'Define threads as a property reference with __P and a default in the Thread Group, then pass -Jthreads with the desired value on the jmeter -n command line.',
    },
    {
      q: 'How do I fail a CI build on JMeter performance regressions?',
      a: 'Generate the dashboard, then script a check on error percentage and response-time statistics from the report output or JTL. Sample errors recorded by JMeter do not always fail the process by themselves, so the pipeline gate must enforce policy.',
    },
    {
      q: 'Should JMeter load tests run on every commit?',
      a: 'Usually no. Use a short smoke on pull requests when needed, and heavier jobs on a schedule or pre-release pipeline. Full-scale tests belong in environments sized for them.',
    },
    {
      q: 'What JMeter artifacts should CI archive?',
      a: 'Archive the HTML report directory, the results JTL or CSV file, and jmeter.log. Keep raw results so you can regenerate reports offline and debug failures.',
    },
    {
      q: 'Can Jenkins and GitHub Actions share the same JMeter plan?',
      a: 'Yes if both invoke the same CLI contract: same JMeter version, properties, and paths. The portable core is the jmx file plus jmeter -n, not a vendor-specific plugin.',
    },
    {
      q: 'Why does JMeter report generation fail in CI?',
      a: 'Common causes are a non-empty report output directory, customized saveservice settings missing columns the dashboard requires, or a failed test that never wrote a valid results file. Use a fresh -o path and keep required CSV fields enabled.',
    },
  ],

  '/topics/distributed-testing': [
    {
      q: 'Does JMeter split 1000 threads across 4 workers?',
      a: 'No. Each worker runs the full test plan. Four workers with 1000 threads configured means about 4000 threads total. JMeter does not shard a single thread group across engines.',
    },
    {
      q: 'Do I need to copy the JMX to every JMeter worker?',
      a: 'No. The client sends the test plan to the servers. You do need to copy external data files such as CSV inputs and ensure the same plugins are installed on each worker.',
    },
    {
      q: 'Should I use GUI or CLI for distributed JMeter load?',
      a: 'Use CLI. The manual recommends starting remote tests from a non-GUI client for real load. The GUI remote start menus are for checking configuration.',
    },
    {
      q: 'What is the default RMI port for JMeter distributed testing?',
      a: 'JMeter RMI commonly uses port 1099 for the server registry connection. Result channels use additional ports. Fix ports with server.rmi.localport and client.rmi.localport when firewalls require static ranges.',
    },
    {
      q: 'Why does SSL matter for JMeter remote testing after 4.0?',
      a: 'Since JMeter 4.0, the default RMI transport uses SSL and needs a keystore. Use the create-rmi-keystore scripts and distribute rmi_keystore.jks to every client and server.',
    },
    {
      q: 'Can JMeter workers run different Java versions?',
      a: 'It may work but is discouraged. Use the same Java version and the same JMeter version on the controller and all workers.',
    },
    {
      q: 'Is distributed mode always better than one JMeter machine?',
      a: 'No. Remote mode adds overhead and can overload the client when many workers stream results. Sometimes one large injector or several independent CLI runs with merged result files is simpler.',
    },
    {
      q: 'How do I start a distributed JMeter test from the command line?',
      a: 'Start jmeter-server on each worker, then on the controller run jmeter -n -t script.jmx -R host1,host2 -l results.jtl. Use -G to set properties on all servers and -X to exit remote servers at the end of the test.',
    },
  ],

  '/topics/functions-and-variables': [
    {
      q: 'What is the difference between a JMeter variable and a property?',
      a: 'Variables are local to a thread. Properties are shared across all threads in the JMeter JVM. Read properties with the __P function and an optional default. Read variables with dollar-brace name syntax.',
    },
    {
      q: 'Why does my JMeter function argument break at a comma?',
      a: 'Commas separate function parameters. Escape literal commas with a backslash inside the parameter, as shown in the functions manual for __time format strings.',
    },
    {
      q: 'Why do I still see ${token} literally in a JMeter request?',
      a: 'The variable was never set, often because an extractor failed or the name does not match. JMeter leaves undefined variable and function references unchanged and does not always log an error.',
    },
    {
      q: 'How do I pass values between JMeter thread groups?',
      a: 'Ordinary variables cannot be read across threads. Use properties, write and re-read files, or other documented sharing approaches. Prefer parameterization with properties for values known before the test starts.',
    },
    {
      q: 'Should I use __CSVRead or CSV Data Set Config in JMeter?',
      a: 'For multi-user data rows such as usernames and passwords, official best practices demonstrate CSV Data Set Config. __CSVRead remains available as a function for specific cases described in the functions reference.',
    },
    {
      q: 'Is BeanShell still recommended in JMeter?',
      a: 'For intensive load, the manual advises JSR223 elements with Groovy because its engine supports compilation caching. BeanShell and JavaScript are discouraged for hot paths. Prefer vars.get inside cached scripts instead of embedding dollar-brace variables in the script text.',
    },
    {
      q: 'How do I set JMeter threads from Jenkins or GitHub Actions?',
      a: 'Set the Thread Group thread count to a __P property reference with a safe default, then pass -Jthreads with the CI value on the jmeter -n command.',
    },
    {
      q: 'Are JMeter function and variable names case-sensitive?',
      a: 'Yes. Variables, functions, and properties are case-sensitive. JMeter also trims spaces from variable names used when storing some function results.',
    },
  ],

  '/topics/http-recorder': [
    {
      q: 'What port does the JMeter HTTP(S) Test Script Recorder use?',
      a: 'The official step-by-step tutorial configures the browser for port 8888, which is the usual default. Always match the port shown in the HTTP(S) Test Script Recorder panel.',
    },
    {
      q: 'Why do I need ApacheJMeterTemporaryRootCA.crt for JMeter recording?',
      a: 'HTTPS recording requires JMeter to present certificates to the browser. Trusting JMeter temporary root CA allows the browser to accept that TLS interception for test traffic. Without it you may see unknown_ca errors.',
    },
    {
      q: 'Should I record images and CSS with JMeter?',
      a: 'Usually no. Best practices say to filter them out with include or exclude patterns. JMeter can fetch embedded resources from HTML later if you enable that option on HTTP Request deliberately.',
    },
    {
      q: 'Where should the JMeter recorder store samples?',
      a: 'Use a Thread Group with a Recording Controller, or set Target Controller explicitly. The recorder expects a place in the test plan tree to store generated HTTP Request samplers.',
    },
    {
      q: 'Why does a JMeter recording fail on replay?',
      a: 'Dynamic values such as CSRF tokens, session ids, and nonces embedded in the recording change on each run. Correlate them with extractors, add an HTTP Cookie Manager, and validate with one thread before load.',
    },
    {
      q: 'Why are no samples recorded in JMeter?',
      a: 'The browser is probably not using the proxy. Confirm manual proxy settings, try a non-localhost site URL if the browser bypasses proxy for localhost, and ensure the recorder is started.',
    },
    {
      q: 'Can JMeter record mobile app HTTP traffic?',
      a: 'If the mobile client can use an HTTP proxy and trusts the JMeter CA, you can capture HTTP and HTTPS API calls. Certificate pinning on the app may block interception.',
    },
    {
      q: 'Is recording enough for a production JMeter load test?',
      a: 'No. Recording creates a draft. You still need parameterization, correlation, assertions, timers, non-GUI execution, and sensible thread sizing before production-scale load.',
    },
  ],

  '/topics/jmeter-vs-alternatives': [
    {
      q: 'Is JMeter outdated compared to k6?',
      a: 'No. JMeter remains widely used for multi-protocol enterprise tests, GUI authoring, offline HTML dashboards, and native remote engines. k6 is often preferred for code-centric HTTP workflows, not as a universal replacement.',
    },
    {
      q: 'Which load testing tool is fastest: JMeter, k6, Locust, or Gatling?',
      a: 'It depends on protocol, workload model, and injector tuning. Asynchronous or Go-based tools often achieve higher HTTP virtual-user density per CPU, while JMeter may win total cost of ownership when protocol breadth or existing jmx assets dominate. Benchmark your own case.',
    },
    {
      q: 'Can JMeter do tests as code?',
      a: 'Yes. Modern JMeter supports programmatic and DSL-style test plan creation, and teams also treat jmx files as versioned artifacts executed with the non-GUI CLI.',
    },
    {
      q: 'Does JMeter support distributed testing without a paid product?',
      a: 'Yes. Official remote testing supports multiple worker engines controlled from one client. You operate the machines, network, and RMI SSL configuration yourself.',
    },
    {
      q: 'What license is Apache JMeter?',
      a: 'Apache JMeter is under the Apache License 2.0. Confirm current terms on the Apache project site for your compliance process.',
    },
    {
      q: 'Should non-developers use k6 or Locust instead of JMeter?',
      a: 'They can, but JMeter GUI and HTTP(S) Test Script Recorder are usually gentler for non-developer authors. Code-first tools shine when authors already write code daily.',
    },
    {
      q: 'Is Gatling only for Scala?',
      a: 'Gatling was historically Scala-centric. Java and Kotlin DSLs are commonly used today. Check current Gatling documentation for first-class language support in your version.',
    },
    {
      q: 'When should I choose JMeter over k6, Locust, or Gatling?',
      a: 'Choose JMeter when you need GUI or recorder-based authoring, multiple in-box protocols beyond HTTP, native remote engines, Apache 2.0 licensing, or you already maintain jmx plans and JMeter skills.',
    },
  ],
};

/**
 * Build a FAQPage JSON-LD object for a given pathname, or null if no FAQ
 * entries exist for that page.
 */
export function buildFaqJsonLd(pathname, canonicalUrl) {
  const key = pathname.replace(/\/$/, '') || '/';
  const entries = faqSchema[key];
  if (!entries || entries.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: canonicalUrl,
    mainEntity: entries.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}
