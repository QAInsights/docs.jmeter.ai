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
      a: 'Threads are approximately target RPS multiplied by cycle time in seconds. Cycle time is average response time plus think time. For example, 50 RPS at 200 ms with no think time needs about 10 threads; the same RPS with 800 ms think time needs about 50 threads. Always validate with a pilot run because real response times rise under load.',
    },
    {
      q: 'What is the formula for JMeter thread group sizing?',
      a: 'Use concurrency approximately equal to arrival rate times cycle time. In JMeter terms: threads approximately equals ceil of target RPS times (response time plus think time) in milliseconds divided by 1000. Add ramp-up and client limits on top of that estimate.',
    },
    {
      q: 'How long should JMeter ramp-up be?',
      a: 'A common starting point is about one second of ramp-up per thread so load increases gradually. Very short ramp-ups create a thundering herd that spikes errors and distorts early samples. Adjust after you see injector and server CPU during a pilot.',
    },
    {
      q: 'Why is my JMeter throughput lower than the calculator estimate?',
      a: 'The calculator assumes a stable response time. Lower throughput usually means response time grew under load, the injector CPU or listeners are saturated, extra timers or pacing are present, or the server is throttling. Re-measure average response time under load, include think time in the calculator, and resize.',
    },
  ],

  '/tools/cli-builder': [
    {
      q: 'How do I run JMeter from the command line?',
      a: 'Use non-GUI mode: jmeter -n -t plan.jmx -l results.jtl. Add -e -o report to generate the HTML dashboard after the run. The report directory should be empty unless you also pass -f to overwrite it.',
    },
    {
      q: 'What do the JMeter -n -t and -l flags mean?',
      a: '-n starts JMeter in non-GUI mode, -t points at the test plan jmx file, and -l writes sample results to a jtl or CSV file. Real load tests should always use -n instead of the GUI.',
    },
    {
      q: 'How do I generate a JMeter HTML dashboard from the CLI?',
      a: 'Add -e -o report/ to the same jmeter -n -t ... -l results.jtl command. JMeter writes the dashboard into that folder when the test finishes. Use -f if you need to overwrite an existing report directory.',
    },
    {
      q: 'How do I set JMeter heap on the command line?',
      a: 'Set the HEAP environment variable for that process, for example HEAP="-Xms512m -Xmx2048m" jmeter -n -t plan.jmx -l results.jtl. HEAP is consumed by JMeter startup scripts, not as a jmeter flag.',
    },
    {
      q: 'How do I pass properties with -J in JMeter?',
      a: 'Use -Jname=value on the command line and read it in the plan with the __P function, for example -Jhost=staging.example.com and ${__P(host,localhost)}. Prefer -J or -q over editing jmeter.properties.',
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
      a: 'Choose JMeter when you need GUI or recorder-based authoring, multiple in-box protocols beyond HTTP, native remote engines, Apache 2.0 licensing, or you already maintain jmx plans and JMeter skills. See the detailed comparison pages for k6, Locust, and Gatling.',
    },
  ],

  '/topics/jmeter-vs-k6': [
    {
      q: 'Is k6 better than JMeter for HTTP load testing?',
      a: 'k6 is often more efficient for pure HTTP at high virtual-user density per CPU, since it uses a Go runtime with goroutine-style VUs. JMeter may win on total cost of ownership when you need broader protocols, existing jmx assets, or GUI authoring. Benchmark your own APIs.',
    },
    {
      q: 'Can I migrate my JMeter jmx plans to k6?',
      a: 'There is no automated 1:1 converter. Re-implement scenarios in JavaScript, rebuild correlation and data feeds, and re-validate think time and workload models since defaults differ.',
    },
    {
      q: 'Does k6 support protocols beyond HTTP?',
      a: 'k6 focuses on HTTP with WebSocket and gRPC ecosystem support. For JDBC, LDAP, JMS, FTP, or mail, JMeter has broader in-box protocol support.',
    },
    {
      q: 'Is k6 open source and free?',
      a: 'k6 has an open-source core but uses AGPL-style licensing with a commercial cloud offering. Verify current terms on the k6 site before enterprise adoption.',
    },
  ],

  '/topics/jmeter-vs-locust': [
    {
      q: 'Is Locust better than JMeter for Python teams?',
      a: 'Locust is a strong fit when Python is the shared language and scenarios are code-first. JMeter is better when you need GUI recording, non-HTTP protocols, or mixed-skill authors who are not comfortable writing Python.',
    },
    {
      q: 'Can I migrate my JMeter jmx plans to Locust?',
      a: 'No automated converter exists. Re-implement scenarios as Python classes, rebuild correlation and data feeds, and re-validate workload models since Locust uses gevent greenlets, not Java threads.',
    },
    {
      q: 'Does Locust support protocols beyond HTTP?',
      a: 'Locust is primarily HTTP-focused. You can build custom clients in Python for unusual protocols, but JMeter has broader in-box samplers for JDBC, LDAP, JMS, FTP, and mail.',
    },
    {
      q: 'Is Locust free to use?',
      a: 'Locust is released under the MIT license, which is simple for most organisations and avoids copyleft concerns.',
    },
  ],

  '/topics/jmeter-vs-gatling': [
    {
      q: 'Is Gatling better than JMeter for HTTP load testing?',
      a: 'Gatling often achieves higher HTTP virtual-user density per CPU due to its async event-driven engine. JMeter may win on protocol breadth, GUI authoring, or when you already maintain jmx plans and JMeter skills.',
    },
    {
      q: 'Do I need to know Scala to use Gatling?',
      a: 'Gatling was historically Scala-centric, but Java and Kotlin DSLs are commonly used today. Check current Gatling documentation for first-class language support in your version.',
    },
    {
      q: 'Can I migrate my JMeter jmx plans to Gatling?',
      a: 'No automated converter exists. Re-implement scenarios in the Gatling DSL, rebuild correlation and data feeds, and re-validate workload models since Gatling uses async VUs, not Java threads.',
    },
    {
      q: 'Is Gatling open source?',
      a: 'Gatling OSS is under the Apache License 2.0, which aligns with many compliance needs. Enterprise editions add collaboration and distributed features.',
    },
  ],

  '/topics/jmeter-vs-enterprise': [
    {
      q: 'Should I switch from LoadRunner to JMeter?',
      a: 'Consider it if HTTP is your dominant protocol, you want to reduce per-VUser licensing costs, and you do not need Citrix, SAP, or TruClient recorders. JMeter covers HTTP, JDBC, LDAP, JMS, FTP, and mail in-box with Apache 2.0 licensing.',
    },
    {
      q: 'Can JMeter replace NeoLoad?',
      a: 'JMeter can replace NeoLoad for HTTP, JDBC, JMS, LDAP, FTP, and mail protocols. If you rely on NeoLoad for Citrix, SAP, or other proprietary protocol recorders, verify JMeter coverage or plan to keep a second tool for those protocols.',
    },
    {
      q: 'Does JMeter have commercial support?',
      a: 'Apache JMeter itself has no vendor support; it relies on community support. Consulting services are available from third parties. If you need SLA-backed support, evaluate commercial tools or support contracts.',
    },
    {
      q: 'How do I migrate from LoadRunner Vuser scripts to JMeter?',
      a: 'Re-implement scenarios in JMeter; there is no 1:1 Vuser script converter. Rebuild correlation and data feeds, re-validate think time and workload models, and map enterprise protocol needs to JMeter samplers early.',
    },
  ],

  '/topics/gui-vs-code-first': [
    {
      q: 'Is GUI-based load testing better than code-first?',
      a: 'Neither is universally better. GUI-based tools are gentler for non-programmers and support recording. Code-first tools offer clean version control, PR review, and CI/CD integration. Choose based on your team skills and workflow.',
    },
    {
      q: 'Can JMeter do both GUI and code-first?',
      a: 'Yes. JMeter supports GUI authoring with jmx files, programmatic test plans via the Kotlin and Java DSL, HTTP(S) recording, and cURL import. Teams can start with the GUI and migrate to code-first for CI.',
    },
    {
      q: 'Should non-developers use code-first tools?',
      a: 'No. Code-first tools like k6, Locust, and Gatling assume programming comfort. JMeter GUI and HTTP(S) Test Script Recorder are usually gentler for non-developer authors.',
    },
    {
      q: 'Do code-first tools support recording?',
      a: 'Most code-first tools do not have a built-in recorder like JMeter. Teams often convert recorded traffic from Postman or curl, or write scenarios from scratch. JMeter bridges this gap with both GUI recording and programmatic plans.',
    },
  ],

  '/topics/jwt-oauth-sso': [
    {
      q: 'Does JMeter have a built-in OAuth sampler?',
      a: 'No. Model token and resource calls with HTTP Request, Header Manager, Cookie Manager, and extractors.',
    },
    {
      q: 'How do I send a JWT bearer token in JMeter?',
      a: 'Extract access_token into a variable, then set the Authorization header to Bearer plus that variable using an HTTP Header Manager.',
    },
    {
      q: 'Should every JMeter thread share one access token?',
      a: 'Usually no. Shared tokens hide per-user behaviour and can hit concurrent-use limits. Prefer CSV users or per-thread logins unless the scenario intentionally uses client credentials.',
    },
    {
      q: 'Why do I get 401 only under load with JWT tests?',
      a: 'Common causes are token expiry, identity provider rate limits, cookie scope issues, or extractors failing when error bodies replace JSON tokens. Assert on the login sampler and review error percentage by label.',
    },
    {
      q: 'Can JMeter load test SAML browser SSO?',
      a: 'You can record HTTP redirects and form posts, but complex browser-only steps may not replay. Many teams inject API tokens for load and test full browser SSO separately.',
    },
    {
      q: 'Where should I store OAuth client secrets for JMeter?',
      a: 'In CI secrets or local environment variables, passed with -J into __P property references, not hard-coded in the jmx file.',
    },
  ],

  '/topics/correlation-dynamic-values': [
    {
      q: 'What is correlation in JMeter?',
      a: 'Capturing dynamic values from responses such as tokens and IDs into variables, then sending them on later requests so multi-step scenarios work for every thread.',
    },
    {
      q: 'Should I use JSON Extractor or Regular Expression Extractor?',
      a: 'For JSON responses, prefer JSON-oriented extractors. Use regular expressions for HTML fragments, headers, or unstructured text.',
    },
    {
      q: 'Why is my JMeter variable still showing as ${csrf}?',
      a: 'The variable was never set. JMeter leaves undefined references unchanged. Fix the extractor and set a default value to detect misses.',
    },
    {
      q: 'Do I need extractors if I use a Cookie Manager?',
      a: 'Cookies often work automatically with Cookie Manager. Body and header tokens still need extractors.',
    },
    {
      q: 'Can one thread read another thread extracted orderId?',
      a: 'Not with ordinary variables. Variables are thread-local by design. Use properties only for intentional global data, not per-user IDs.',
    },
    {
      q: 'How do I correlate values after recording a script?',
      a: 'Replay with one thread, find the first failure, extract from the previous response, replace hard-coded values, and repeat until the journey is green.',
    },
  ],

  '/topics/websocket-load-testing': [
    {
      q: 'Does stock Apache JMeter include a WebSocket sampler?',
      a: 'WebSocket support is provided through the plugin ecosystem, not as a primary core sampler like HTTP Request. Install a maintained WebSocket plugin via Plugins Manager or manual JARs.',
    },
    {
      q: 'Can I use the HTTP(S) Test Script Recorder for WebSockets?',
      a: 'The recorder is built for HTTP and HTTPS request capture. Do not expect full WebSocket frame recording the way you record REST calls. Build socket steps with a plugin after HTTP login when needed.',
    },
    {
      q: 'How many threads do I need for WebSocket tests?',
      a: 'Often one thread per concurrent connection for classic Thread Groups. Size from concurrent sessions and message pacing, then validate injector CPU, RAM, and file descriptors.',
    },
    {
      q: 'Do WebSocket plugins need to be on every distributed worker?',
      a: 'Yes. Workers must match the controller JMeter version and plugin set, the same as other third-party libraries in remote testing.',
    },
    {
      q: 'Should I generate an HTML dashboard for WebSocket tests?',
      a: 'Yes if the plugin writes standard sample results. Label connect, write, read, and close clearly so statistics remain readable.',
    },
  ],

  '/topics/grafana-influx-backend-listener': [
    {
      q: 'What is JMeter Backend Listener?',
      a: 'A listener that sends metrics to external backends through a BackendListenerClient implementation instead of only showing GUI graphs.',
    },
    {
      q: 'Which InfluxDB Backend Listener client should I use?',
      a: 'For live dashboards during large tests, start with InfluxdbBackendListenerClient introduced in JMeter 3.2. Use InfluxDBRawBackendListenerClient from JMeter 5.4 when you need raw sample writes and can afford the volume.',
    },
    {
      q: 'Does Backend Listener replace the HTML report?',
      a: 'No. Keep results with -l and generate HTML dashboards with -e -o for offline analysis. Backend Listener is for live monitoring.',
    },
    {
      q: 'Can I use Graphite instead of InfluxDB with JMeter?',
      a: 'Yes. GraphiteBackendListenerClient ships with JMeter. Grafana can also query Graphite datasources.',
    },
    {
      q: 'Why are some Grafana series empty for my samplers?',
      a: 'Check samplersRegex filters, whether those labels actually ran, and Transaction Controller parent or child settings that change what is emitted.',
    },
    {
      q: 'How do JMeter Grafana annotations work?',
      a: 'InfluxdbBackendListenerClient can write events used as Grafana annotations. Event tags and title-related fields help tag runs. See the component reference and real-time results chapter.',
    },
  ],

  '/topics/docker-kubernetes': [
    {
      q: 'Is there an official Apache JMeter Docker image?',
      a: 'Treat public images as community or vendor builds unless you verify Apache provenance. Prefer pinned, scanned images your team controls.',
    },
    {
      q: 'What is the essential JMeter CLI inside a container?',
      a: 'jmeter -n -t plan.jmx -l results.jtl, plus -e -o report/ when you need the HTML dashboard artifact.',
    },
    {
      q: 'How do I pass threads and host into a containerized JMeter plan?',
      a: 'Use __P property defaults in the plan and pass -Jthreads and -Jhost in the docker or Kubernetes container args.',
    },
    {
      q: 'Can I run the JMeter GUI in Docker?',
      a: 'It is possible with remote display setups, but load tests should be non-GUI. Use the GUI locally for authoring.',
    },
    {
      q: 'How do I get JMeter reports out of Kubernetes?',
      a: 'Mount a persistent volume, upload to object storage when the job ends, or copy files from the pod before it is deleted.',
    },
    {
      q: 'Do distributed JMeter workers work on Kubernetes?',
      a: 'Yes if RMI ports, SSL keystores, identical software, and data mounts are correct. Many teams prefer multiple independent CLI jobs to avoid RMI complexity.',
    },
  ],

  '/topics/plugins-essentials': [
    {
      q: 'Are JMeter plugins part of Apache core?',
      a: 'Popular plugins are community extensions installed into lib/ext. Core JMeter ships many protocols, but not every modern stack client.',
    },
    {
      q: 'What is JMeter Plugins Manager?',
      a: 'A community tool that installs plugin sets into your JMeter installation from a catalog. Restart JMeter after installs when required.',
    },
    {
      q: 'Do I need plugins for HTTP API tests?',
      a: 'Often no. HTTP Request, Header Manager, CSV Data Set, extractors, and the HTML dashboard are core. Add plugins for missing protocols or advanced thread schedules.',
    },
    {
      q: 'Why does my jmx fail on another machine?',
      a: 'That machine lacks the plugins or JMeter version used when the plan was saved. Align installations or remove plugin-only elements.',
    },
    {
      q: 'Can plugins be used in non-GUI mode?',
      a: 'Yes. CLI loads the same lib/ext classes. Ensure the CI or container image contains them.',
    },
    {
      q: 'Where do I learn to write my own JMeter plugin?',
      a: 'See the Extending JMeter developer guide for custom samplers, listeners, and related extension points.',
    },
  ],

  '/topics/troubleshooting': [
    {
      q: 'Why do I get connection reset only under load in JMeter?',
      a: 'Often server or load balancer limits, injector port exhaustion, or timeouts. Compare server metrics and run from the same network as the injector.',
    },
    {
      q: 'Why do I get 401 after a successful JMeter recording?',
      a: 'Dynamic tokens or cookies were not correlated. Add Cookie Manager and extractors, and do not reuse recorded bearer tokens.',
    },
    {
      q: 'How do I fix OutOfMemoryError in JMeter?',
      a: 'Increase heap, reduce threads per JVM, disable View Results Tree, save fewer result fields, and prefer JSR223 Groovy over heavy scripts on hot paths.',
    },
    {
      q: 'Why is JMeter throughput lower than the thread calculator?',
      a: 'Calculators assume stable response times and little think time. Under load, response times rise and listeners or server limits reduce throughput.',
    },
    {
      q: 'What is the first log to read when JMeter fails?',
      a: 'jmeter.log or the file set with -j, plus the first failing sampler message in View Results Tree or the results file.',
    },
    {
      q: 'Why does JMeter work in GUI but fail in CI?',
      a: 'Different working directory, missing CSV files, missing plugins, wrong -J properties, or network policy from the CI runner are common causes.',
    },
  ],

  '/topics/interview-questions': [
    {
      q: 'Are these JMeter interview answers enough to pass any interview?',
      a: 'They cover common JMeter topics with correct mental models. Deep system design and company-specific tools still need broader performance engineering study.',
    },
    {
      q: 'Should I memorize every JMeter component field for interviews?',
      a: 'No. Know core concepts and where to look up fields in the component reference.',
    },
    {
      q: 'Is GUI mode acceptable for load tests in interviews?',
      a: 'Say no for real load. Explain non-GUI mode and why heavy listeners distort injector performance.',
    },
    {
      q: 'What JMeter version should I mention in interviews?',
      a: 'Speak to current stable lines and features you have used, such as dashboard reporting and 5.6 programmatic helpers, and verify details against release notes.',
    },
    {
      q: 'How can I practice JMeter quickly before an interview?',
      a: 'Build a small API plan, correlate a token, run non-GUI with an HTML report, and deliberately break then fix one failure using a troubleshooting checklist.',
    },
  ],

  '/topics/jmeter-for-beginners': [
    {
      q: 'Do I need to know Java to use JMeter?',
      a: 'Not for basic HTTP plans. A Java runtime is required to run JMeter. Groovy helps later for advanced scripting.',
    },
    {
      q: 'Which JMeter version should beginners install?',
      a: 'A current stable release. Avoid versions older than several releases behind the latest, as recommended in best practices.',
    },
    {
      q: 'Is the HTTP(S) Test Script Recorder required for beginners?',
      a: 'No. For APIs, manual HTTP Request or curl import is often cleaner. The recorder helps more for browser-style web journeys.',
    },
    {
      q: 'How many threads should I use for a first JMeter test?',
      a: 'Start with one thread to validate, then a small number such as five to ten. Size larger tests with pilots and a thread calculator.',
    },
    {
      q: 'Where is the JMeter HTML report after a CLI run?',
      a: 'In the folder you pass to -o after successful -e generation. Open index.html in that folder.',
    },
    {
      q: 'What should beginners learn after the first HTML report?',
      a: 'Correlation of dynamic values, CSV and property parameterization, and automating the same non-GUI command in CI.',
    },
  ],

  '/topics/apdex-slo-percentiles': [
    {
      q: 'What is APDEX in JMeter?',
      a: 'A satisfaction score derived from response times versus configured satisfied and tolerated thresholds, shown in the HTML dashboard APDEX table.',
    },
    {
      q: 'What are the default JMeter APDEX thresholds?',
      a: '500 milliseconds for satisfied and 1500 milliseconds for tolerated unless you override reportgenerator properties.',
    },
    {
      q: 'Why not use only average response time for SLOs?',
      a: 'Averages hide long tails. Users feel high percentiles. SLOs should specify percentiles and error rates.',
    },
    {
      q: 'How do I change percentiles on the JMeter dashboard?',
      a: 'Set aggregate_rpt_pct1, aggregate_rpt_pct2, and aggregate_rpt_pct3. Defaults are 90, 95, and 99.',
    },
    {
      q: 'Can APDEX thresholds differ per API in JMeter?',
      a: 'Yes. Use jmeter.reportgenerator.apdex_per_transaction with sample names or regular expressions as documented in the dashboard chapter.',
    },
    {
      q: 'Does a green APDEX mean production is safe?',
      a: 'No. It means samples in that test met thresholds under that load model and environment. Combine with capacity planning and production monitoring.',
    },
  ],

  '/topics/programmatic-dsl-plans': [
    {
      q: 'Is the JMeter DSL production-ready?',
      a: 'JMeter 5.6 documents programmatic helpers as experimental. Teams can use them but should pin versions and watch release notes.',
    },
    {
      q: 'Can I keep using jmx files if I adopt code-first JMeter?',
      a: 'Yes. Programmatic APIs are optional. Versioned jmx files plus non-GUI CLI remain fully supported.',
    },
    {
      q: 'Should I use the Kotlin or Java DSL for JMeter?',
      a: 'Choose based on team language. Both are documented. The Copy Code action often illustrates Kotlin DSL output in the manual.',
    },
    {
      q: 'Does code-first authoring remove the need for non-GUI mode?',
      a: 'No. Real load should still run non-GUI with minimal listeners regardless of how the plan was authored.',
    },
    {
      q: 'Where is Copy Code in JMeter?',
      a: 'In the GUI context menu on a test plan tree element. It generates code for the element and its children as documented in the programmatic chapter.',
    },
    {
      q: 'Why use ListedHashTree instead of HashTree?',
      a: 'HashTree does not honour element order, so children may shuffle. ListedHashTree preserves order for programmatic plans.',
    },
  ],

  '/topics/grpc-kafka-mqtt': [
    {
      q: 'Does Apache JMeter core include Kafka or gRPC samplers?',
      a: 'Not as the primary built-in story like HTTP Request. Use plugins, custom samplers, or load adjacent HTTP APIs that front those systems.',
    },
    {
      q: 'Can I use JMeter JMS samplers for Kafka?',
      a: 'Only if you intentionally use a JMS layer. Wire-level Kafka clients are different. Prefer a Kafka plugin or other tools for Kafka protocol load.',
    },
    {
      q: 'How do I install gRPC Kafka or MQTT plugins for JMeter?',
      a: 'Use Plugins Manager or place JARs in lib/ext, restart JMeter, pin versions, and mirror the same set into CI and worker images.',
    },
    {
      q: 'What is the biggest distributed testing risk with protocol plugins?',
      a: 'Workers missing plugin JARs or version skew causing ClassNotFoundException or serialization errors.',
    },
    {
      q: 'Should every message protocol test be done in JMeter?',
      a: 'No. Choose JMeter when it fits team skills and hybrid protocols. Use specialized tools when they are clearly better for a single technology.',
    },
    {
      q: 'How do I assert success for async messaging in JMeter?',
      a: 'Define explicit signals such as produce acknowledgement, message visibility to a consumer, or a downstream HTTP status. Fire-and-forget without observability is a weak test.',
    },
  ],

  // --- Error playbooks ---
  '/topics/errors': [
    {
      q: 'What are JMeter error playbooks?',
      a: 'Short symptom-based guides for common JMeter failures such as ConnectException, SSL handshake errors, OutOfMemoryError, stuck throughput, GUI versus CLI failures, and 401 after recording. Each page covers symptom, causes, fix order, and related tools.',
    },
    {
      q: 'Should I use the error playbooks or the full troubleshooting guide?',
      a: 'Use an error playbook when you already know the exception or symptom. Use the full troubleshooting guide for the end-to-end triage tree from one thread to full load.',
    },
  ],

  '/topics/errors/connect-exception': [
    {
      q: 'What does java.net.ConnectException mean in JMeter?',
      a: 'JMeter could not establish a TCP connection to the configured host and port. Typical messages are connection refused or connection timed out, often shown as a Non HTTP response code.',
    },
    {
      q: 'How do I fix ConnectException in JMeter?',
      a: 'Verify host, port, and protocol on HTTP Request Defaults, confirm the service is listening, test connectivity from the same machine that runs JMeter, and ensure CLI properties such as -Jhost match the plan.',
    },
    {
      q: 'Why does ConnectException happen only in CI?',
      a: 'CI runners often cannot reach private staging networks, or -Jhost and secrets differ from your laptop. Test connectivity from the runner environment first.',
    },
  ],

  '/topics/errors/non-http-response-code': [
    {
      q: 'What is Non HTTP response code in JMeter?',
      a: 'It means the HTTP sampler failed with a client-side exception before a normal HTTP status line was returned. The real error is the nested Java exception in the response message.',
    },
    {
      q: 'Is Non HTTP response code an HTTP 500?',
      a: 'No. It is not a server status code. Inspect the nested exception such as ConnectException, SSLHandshakeException, or SocketException to choose the right fix.',
    },
  ],

  '/topics/errors/ssl-handshake-exception': [
    {
      q: 'Why does JMeter fail SSL when the browser works?',
      a: 'Browsers trust the OS certificate store. JMeter uses the JVM truststore unless configured otherwise. Import the required CA into the Java truststore that launches JMeter.',
    },
    {
      q: 'What causes unknown_ca during JMeter recording?',
      a: 'The browser has not accepted the JMeter proxy certificate. Install ApacheJMeterTemporaryRootCA from the JMeter launch directory into the browser trust store.',
    },
    {
      q: 'Is distributed RMI SSL the same as HTTPS sampler SSL?',
      a: 'No. RMI SSL between controller and workers uses the RMI keystore setup documented for remote testing. HTTPS sampler failures are about the system under test certificates.',
    },
    {
      q: 'What does Unsupported or unrecognized SSL message mean in JMeter?',
      a: 'It means JMeter tried to speak TLS to a port that answers with something else, usually plain HTTP. Use https only against ports that actually serve TLS, and check the sampler protocol and port first.',
    },
  ],

  '/topics/errors/out-of-memory-heap': [
    {
      q: 'How do I fix OutOfMemoryError Java heap space in JMeter?',
      a: 'Run non-GUI load, disable View Results Tree, increase HEAP or -Xmx, reduce threads per engine, save fewer result fields, prefer Groovy over heavy scripts, and ensure container memory limits exceed the heap.',
    },
    {
      q: 'Is JMeter OutOfMemoryError always the server under test?',
      a: 'Often it is the injector JVM. Check JMeter heap and GC behaviour before blaming the application servers.',
    },
  ],

  '/topics/errors/socket-closed-connection-reset': [
    {
      q: 'What causes connection reset in JMeter load tests?',
      a: 'Common causes include server or load balancer connection limits, idle timeouts closing keep-alive sockets, injector port exhaustion, application restarts, and unstable network paths.',
    },
    {
      q: 'Why do connection resets appear only under high load?',
      a: 'Connection pools and operating system limits usually appear only when many sockets are open. One-thread tests often hide those limits.',
    },
  ],

  '/topics/errors/throughput-stuck': [
    {
      q: 'Why is JMeter throughput lower than my target RPS?',
      a: 'Typical reasons are too few threads for the response time, response time growth under load, heavy listeners, think time, injector saturation, or server throttling. Size threads from measured response time and validate in CLI mode.',
    },
    {
      q: 'Does adding threads always increase JMeter RPS?',
      a: 'No. After the server saturates, extra threads mainly increase queueing and latency rather than useful throughput.',
    },
  ],

  '/topics/errors/gui-works-cli-fails': [
    {
      q: 'Why does my JMeter plan work in GUI but fail in CLI?',
      a: 'Common causes are different working directories for relative CSV paths, missing -J properties, missing plugins on the CLI host, network limits on CI agents, or different user.properties files.',
    },
    {
      q: 'Should I trust GUI-only success before CI?',
      a: 'No. Always prove the plan with jmeter -n on a representative environment before relying on it in pipelines.',
    },
  ],

  '/topics/errors/401-403-after-recording': [
    {
      q: 'Why do I get 401 after recording a JMeter script?',
      a: 'Replay starts a new session. Recorded cookies and tokens are often stale. Add a Cookie Manager and correlate CSRF tokens, hidden fields, or Bearer tokens for each virtual user.',
    },
    {
      q: 'Do I need extractors if I already have a Cookie Manager?',
      a: 'Cookies often handle classic server sessions. CSRF tokens, hidden form fields, and Authorization bearer tokens still need extractors.',
    },
  ],

  '/topics/errors/socket-timeout-exception': [
    {
      q: 'What is the difference between Read timed out and connect timed out in JMeter?',
      a: 'Connect timed out means the initial TCP handshake failed to complete within the connect timeout limit. Read timed out means the TCP connection was established, but the target server took longer to send response bytes than the configured response timeout.',
    },
    {
      q: 'How do I configure timeouts in JMeter?',
      a: 'Add an HTTP Request Defaults configuration element to your test plan, navigate to the Timeouts section, and configure explicit Connect and Response timeout values in milliseconds.',
    },
    {
      q: 'Does increasing JMeter timeout fix slow server performance?',
      a: 'No. Increasing timeouts only stops JMeter from failing the sample early. If response times exceed your service level agreements, you must optimize server application code, database queries, or server capacity.',
    },
  ],

  '/topics/errors/no-http-response-exception': [
    {
      q: 'What causes NoHttpResponseException in JMeter?',
      a: 'It is typically caused by an HTTP Keep-Alive race condition where the server or intermediate load balancer closes an idle persistent TCP socket, and JMeter attempts to reuse the closed socket without validating its state.',
    },
    {
      q: 'How do I fix NoHttpResponseException in JMeter?',
      a: 'Set httpclient4.validate_after_inactivity=2000 and httpclient4.idletimeout=10000 in user.properties, and ensure server keep-alive timeouts are aligned with client settings.',
    },
  ],

  '/topics/errors/unknown-host-exception': [
    {
      q: 'Why does UnknownHostException occur in JMeter?',
      a: 'UnknownHostException occurs when the Java Virtual Machine cannot resolve the domain name into an IP address using system DNS or JMeter DNS Cache Manager.',
    },
    {
      q: 'How do I fix UnknownHostException in JMeter?',
      a: 'Ensure the Server Name field contains only the domain name without protocols or paths, verify CLI property values, and add a DNS Cache Manager with custom DNS mappings if testing internal staging environments.',
    },
  ],

  '/topics/errors/bind-exception-address-in-use': [
    {
      q: 'What causes java.net.BindException Address already in use in JMeter?',
      a: 'It is caused by ephemeral port exhaustion on the load generator machine when opening and closing thousands of outbound TCP connections without Keep-Alive, leaving sockets in TIME_WAIT state.',
    },
    {
      q: 'How do I resolve port exhaustion in JMeter load testing?',
      a: 'Enable Use KeepAlive in HTTP Request Defaults, tune operating system ephemeral port ranges and TIME_WAIT timeouts via sysctl or Windows registry, and scale horizontally across distributed worker nodes.',
    },
  ],

  '/topics/errors/ssl-peer-unverified': [
    {
      q: 'What causes SSLPeerUnverifiedException in JMeter?',
      a: 'It occurs when the target server presents an SSL certificate whose Subject Common Name or Subject Alternative Names do not match the hostname requested by JMeter.',
    },
    {
      q: 'How do I resolve certificate hostname mismatches in JMeter?',
      a: 'Use the domain name in HTTP samplers rather than direct IP addresses, route hostnames via DNS Cache Manager, and configure custom truststores using Java system properties.',
    },
  ],

  '/topics/errors/http-502-503-504': [
    {
      q: 'What is the difference between HTTP 500, 502, 503, and 504 in JMeter tests?',
      a: 'HTTP 500 is an unhandled application crash. HTTP 502 indicates a reverse proxy could not connect to upstream backend pods. HTTP 503 means server queues or connection pools are full. HTTP 504 means the upstream app took longer than the proxy gateway timeout.',
    },
    {
      q: 'How do I view error details for HTTP 5xx responses in JMeter?',
      a: 'Add a View Results Tree listener during single-thread debugging to inspect response bodies, or enable jmeter.save.saveservice.response_data.on_error in user.properties for CLI test runs.',
    },
  ],

  '/topics/errors/http-415-400-bad-request': [
    {
      q: 'Why does JMeter return HTTP 415 Unsupported Media Type?',
      a: 'HTTP 415 occurs when an API requires Content-Type application/json or application/xml, but the request was sent without an HTTP Header Manager specifying the required Content-Type.',
    },
    {
      q: 'How do I fix HTTP 400 Bad Request in JMeter REST API testing?',
      a: 'Check the Body Data tab for unquoted JSON strings, ensure variable interpolation syntax is valid, and uncheck Use multipart/form-data unless performing file uploads.',
    },
  ],

  '/topics/errors/http-429-rate-limited': [
    {
      q: 'Why am I getting HTTP 429 Too Many Requests in JMeter?',
      a: 'HTTP 429 indicates that the target server or API gateway rate limiter has capped your request frequency per IP address or per authenticated API token.',
    },
    {
      q: 'How do I prevent WAF and rate limit blocks during JMeter load testing?',
      a: 'Set realistic User-Agent headers, parameterize user credentials from CSV, use pacing timers like Precise Throughput Timer, coordinate test IP whitelisting with DevOps, or distribute load across multiple injector nodes.',
    },
  ],

  '/topics/errors/outofmemory-unable-to-create-native-thread': [
    {
      q: 'What causes OutOfMemoryError unable to create new native thread in JMeter?',
      a: 'It is caused by hitting operating system user process limits, system PID limits, or exhausting native RAM available for OS thread stacks outside the Java heap.',
    },
    {
      q: 'How do I fix unable to create new native thread in JMeter?',
      a: 'Increase ulimit -u in /etc/security/limits.conf, tune kernel.pid_max, reduce JVM thread stack size using -Xss256k, and distribute load across multiple worker engines.',
    },
  ],

  '/topics/errors/metaspace-gc-overhead-limit': [
    {
      q: 'What causes OutOfMemoryError Metaspace in JMeter?',
      a: 'The most common cause is embedding variable interpolation inside JSR223 Groovy scripts, which forces the Groovy engine to compile a new Java class into Metaspace on every execution.',
    },
    {
      q: 'How do I prevent Groovy Metaspace memory leaks in JMeter?',
      a: 'Always use vars.get() instead of string interpolation inside scripts, check Cache compiled script if available in JSR223 elements, and increase -XX:MaxMetaspaceSize=512m in JVM_ARGS.',
    },
  ],

  '/topics/errors/jmeter-freeze-high-cpu-hanging': [
    {
      q: 'Why does JMeter GUI freeze during a load test?',
      a: 'Visual listeners like View Results Tree store raw response payloads in heap memory and block the Swing event dispatch thread. Always use CLI mode for load testing.',
    },
    {
      q: 'Why does JMeter CLI hang at the end of a test run?',
      a: 'Active non-daemon threads from custom plugins, unclosed JDBC connection pools, or async metrics listeners can prevent JVM shutdown. Enable jmeterengine.force.system.exit=true in user.properties.',
    },
  ],

  '/topics/errors/jsr223-groovy-script-errors': [
    {
      q: 'What causes MissingPropertyException in JMeter JSR223 Groovy scripts?',
      a: 'It occurs when accessing a JMeter variable directly by name instead of retrieving it through the vars object using vars.get(variableName).',
    },
    {
      q: 'How do I pass variables between different Thread Groups in JMeter?',
      a: 'Use the props object. Set a global property in the source thread group with props.put(key, value) and read it in the destination thread group with props.get(key).',
    },
  ],

  '/topics/errors/class-not-found-noclassdeffound': [
    {
      q: 'Where do I put third-party JAR files and JDBC drivers in JMeter?',
      a: 'Place utility libraries, JDBC database drivers, and messaging client JARs in JMETER_HOME/lib. Place JMeter GUI plugins and visualizers in JMETER_HOME/lib/ext, then restart JMeter.',
    },
    {
      q: 'Why is my newly added JAR file not recognized by JMeter?',
      a: 'Java classloaders cannot dynamically scan new JAR files while the JVM is active. You must restart JMeter or launch a fresh CLI process for changes to take effect.',
    },
  ],

  '/topics/errors/extractor-not-found-default-value': [
    {
      q: 'Why does my JSON Extractor or Regex Extractor return NOT_FOUND?',
      a: 'Common reasons include incorrect PostProcessor scoping, targeting Body instead of Response Headers for cookies, invalid JSONPath or Regex syntax, or the extractor running before the target response arrives.',
    },
    {
      q: 'How do I test my regular expression or JSONPath in JMeter?',
      a: 'Open View Results Tree, run a single request, switch the response pane dropdown from Text to JSON Path Tester or RegExp Tester, and evaluate your expression against the live response.',
    },
  ],

  '/topics/errors/csv-data-set-file-not-found-sharing': [
    {
      q: 'Why does CSV Data Set Config fail with FileNotFoundException in CLI mode?',
      a: 'JMeter resolves relative paths from the directory where the command was executed. Use the FileServer getBaseDir Groovy expression to resolve paths relative to the JMX file.',
    },
    {
      q: 'What is the difference between Sharing Modes in CSV Data Set Config?',
      a: 'All threads shares one global file pointer across all virtual users. Current thread group maintains independent file pointers per Thread Group. Current thread gives each thread its own independent file reader.',
    },
  ],

  '/topics/errors/rmi-connection-refused-remote-testing': [
    {
      q: 'What causes Connection refused to host 127.0.0.1 in JMeter distributed testing?',
      a: 'Remote worker nodes bound their RMI registry to the local loopback address. Start jmeter-server with -Djava.rmi.server.hostname set to the routable network IP of the worker.',
    },
    {
      q: 'Why does JMeter distributed testing fail with rmi_keystore.jks missing?',
      a: 'JMeter enables RMI over SSL by default. Either run create-rmi-keystore script to generate a shared keystore across all nodes or set server.rmi.ssl.disable=true in user.properties.',
    },
    {
      q: 'Why does jmeter-server bind to the wrong IP on a multi-homed host?',
      a: 'Without an explicit setting, Java RMI picks an address from the default network interface, which on multi-homed or containerized hosts can be an internal or loopback address. Start the worker with -Djava.rmi.server.hostname set to the routable IP and list routable IPs in remote_hosts.',
    },
  ],

  '/topics/errors/jdbc-connection-pool-errors': [
    {
      q: 'What causes Cannot create PoolableConnectionFactory in JMeter JDBC testing?',
      a: 'It indicates database connection failure due to incorrect JDBC URLs, missing database driver JARs in lib, incorrect credentials, or database firewall blocks.',
    },
    {
      q: 'How do I fix database connection pool exhaustion in JMeter?',
      a: 'Increase Max Number of Connections in JDBC Connection Configuration to match concurrency and configure a lightweight Validation Query like SELECT 1.',
    },
  ],

  '/topics/errors/html-dashboard-generation-errors': [
    {
      q: 'Why does JMeter HTML report fail with output folder not empty?',
      a: 'JMeter requires the target destination directory specified with -o to be completely empty or non-existent to prevent accidental data overwriting.',
    },
    {
      q: 'How do I fix Consumer failed with message Begin date cannot be after end date in JMeter?',
      a: 'This error occurs when timestamps in the JTL file are out of chronological order. Sort the CSV rows by timestamp or delete old JTL files before starting a new test run.',
    },
  ],

  '/topics/errors/jmeter-wont-start-crash-on-launch': [
    {
      q: 'Why does the JMeter window flash and close immediately?',
      a: 'The GUI hides console errors, so a failed startup looks like a window that closes itself. Launch jmeter.bat or ./jmeter from a terminal: the printed stack trace names the actual cause, usually Java, heap, or a broken installation.',
    },
    {
      q: 'Which Java version does JMeter need?',
      a: 'JMeter 5.x requires Java 8 or newer, and a current LTS JDK such as 17 or 21 is recommended for load generators. Verify with java -version and install a JDK if the command is missing.',
    },
    {
      q: 'Can a corrupt test plan stop JMeter from starting?',
      a: 'No. Test plans load after startup, so a broken JMX cannot prevent the GUI from opening. If JMeter itself does not open, the cause is the Java runtime, the heap, or the installation, not the plan.',
    },
  ],

  '/topics/errors/too-many-open-files-ulimit': [
    {
      q: 'What does Too many open files mean in JMeter?',
      a: 'The JVM tried to open a socket or file but the operating system refused because the process reached its file descriptor limit. It is an OS resource limit error, not a JMeter bug.',
    },
    {
      q: 'How do I check how many file descriptors JMeter is using?',
      a: 'On Linux, count them with lsof -p followed by the JMeter process ID and compare against the open files limits shown in /proc for that process. On macOS, use lsof the same way.',
    },
    {
      q: 'Why does raising ulimit in another terminal not fix JMeter?',
      a: 'Limits are inherited when a process starts. The shell where you run ulimit must be the same shell that launches JMeter, and the change does not reach processes that are already running.',
    },
  ],

  '/topics/errors/http-407-proxy-authentication': [
    {
      q: 'What is HTTP 407 in JMeter?',
      a: 'It means an intermediate proxy, not the target application, rejected the request because the proxy credentials are missing or wrong. JMeter must authenticate to the proxy before the request is forwarded.',
    },
    {
      q: 'What is the difference between 401 and 407?',
      a: 'A 401 comes from the target server and means the application wants authentication. A 407 comes from a proxy in front of the target and means the proxy itself wants authentication. The fix targets a different credential in each case.',
    },
    {
      q: 'How do I pass proxy credentials without storing them in the test plan?',
      a: 'Use -Jhttp.proxyUser and -Jhttp.proxyPass on the command line, or set the properties in a user.properties file that stays out of version control. In CI pipelines, source the values from the secret store.',
    },
  ],

  '/topics/errors/premature-eof-connection-abort': [
    {
      q: 'What does Premature EOF mean in JMeter?',
      a: 'The response stream ended before the complete body arrived. JMeter was still reading when the connection closed, so the sample fails instead of returning a full response.',
    },
    {
      q: 'Is Premature EOF a JMeter bug?',
      a: 'No. The connection was closed on the server side, by the application, a load balancer, or a proxy. JMeter only reports the cut stream; the fix lives in timeout alignment or server capacity.',
    },
    {
      q: 'When should I enable httpclient4.gzip_relax_mode?',
      a: 'Only after confirming that a specific application sends complete bodies with early-ended gzip streams. Relaxed mode also masks genuine truncation, so treat it as a targeted workaround, not a default.',
    },
  ],

  '/topics/errors/works-in-browser-fails-in-jmeter': [
    {
      q: 'Why does JMeter not execute JavaScript like a browser?',
      a: 'JMeter is a protocol-level tool: it sends and receives HTTP requests without rendering pages or running scripts. Any request a browser fires from JavaScript must be discovered in DevTools and scripted as an explicit HTTP Request.',
    },
    {
      q: 'Which browser headers does JMeter actually need?',
      a: 'Only the ones the server or WAF inspects. Start with User-Agent, Accept, Content-Type, and any custom security headers visible in DevTools, then add more only while failures persist.',
    },
    {
      q: 'Why does my recorded script fail on the second run?',
      a: 'Recording captures tokens and cookies that expire after the first use. Add a Cookie Manager and correlate CSRF tokens, session IDs, and bearer values so each virtual user gets fresh ones.',
    },
  ],

  '/topics/errors/test-stops-early-unexpectedly': [
    {
      q: 'Why did my JMeter test stop after only a few seconds?',
      a: 'Usually the Thread Group scheduler: Specify Thread lifetime is checked with a short Duration in seconds. The other common cause is a sampler error action set to Stop Test combined with an early failing sample.',
    },
    {
      q: 'Where do I see why JMeter stopped the test?',
      a: 'Check jmeter.log for end-of-test messages, then the results file for the last samples. A clean stop shows listener notifications; a crash leaves no end-of-test lines at all, which points to the JVM dying.',
    },
    {
      q: 'Can a failing assertion stop the whole test?',
      a: 'Yes. A failed assertion marks its sample as failed, and the Thread Group sampler error action then applies to it exactly like a transport error. Fix the assertion or change the action to Continue.',
    },
  ],

  '/topics/errors/jmx-wont-load-corrupt-plan': [
    {
      q: 'Can a corrupted JMX file be repaired?',
      a: 'Often, yes. If the damage is a truncated tail or merge conflict markers, fixing the XML by hand restores the plan. When whole sections are missing, restoring from git or a backup is faster and safer than reconstruction.',
    },
    {
      q: 'Why does my JMX open on another machine but not mine?',
      a: 'Version or plugin differences. Check the jmeter attribute in the JMX header against your installed version, and compare the contents of lib/ext for plugin JARs the plan depends on.',
    },
    {
      q: 'Where does JMeter report the exact XML error?',
      a: 'In jmeter.log. The SAXParseException line names the problem and includes line and column numbers, which map directly to a position in the JMX file.',
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
