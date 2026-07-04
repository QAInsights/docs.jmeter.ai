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
