/**
 * Curated HowTo step data for JMeter tutorial pages.
 * Used by SeoHead.astro to inject HowTo JSON-LD structured data,
 * which can trigger step-by-step rich result cards in Google search.
 *
 * Steps are plain text (no markdown) per JSON-LD spec.
 * Keyed by pathname (without trailing slash, matching Astro.url.pathname).
 */
export const howtoSchema = {
  '/user-manual/build-test-plan': {
    name: 'How to Build a Test Plan in JMeter',
    description: 'Learn how to create, configure, save, run, and stop a JMeter test plan step by step.',
    step: [
      { name: 'Add and Remove Elements', text: 'Right-click on an element in the tree and choose a new element from the Add list. To remove an element, select it, right-click, and choose Remove.' },
      { name: 'Load and Save Elements', text: 'Right-click on an existing tree element and select Merge to load elements from a file. To save, right-click an element and choose Save Selection As to save it plus all child elements.' },
      { name: 'Configure Tree Elements', text: 'Select any element in the test tree to view its controls in the right-hand frame. Configure the behavior of that particular element based on its type.' },
      { name: 'Save the Test Plan', text: 'Select Save or Save Test Plan As from the File menu. You can save the entire Test Plan or only a portion by selecting a specific branch element first.' },
      { name: 'Run a Test Plan', text: 'Choose Start (Control+R) from the Run menu. A green box appears at the right end of the section under the menu bar when JMeter is running. Use CLI mode for real load tests instead of GUI mode.' },
      { name: 'Stop a Test', text: 'Use Stop (Control+.) to stop threads immediately, or Shutdown (Control+,) to request threads to stop at the end of current work. In CLI mode, use the shutdown or stoptest scripts from the bin directory.' },
      { name: 'Check Error Reporting', text: 'JMeter reports warnings and errors to the jmeter.log file. Click the warning icon to view the log file at the bottom of the JMeter window. Sampling errors are stored as attributes of the sample result, visible in Listeners.' },
    ],
  },

  '/user-manual/build-web-test-plan': {
    name: 'How to Build a Web Test Plan in JMeter',
    description: 'Create a basic JMeter test plan to test a web site with multiple simulated users sending HTTP requests.',
    step: [
      { name: 'Add Users with a Thread Group', text: 'Select the Test Plan, right-click, and choose Add then ThreadGroup. Name it JMeter Users, set the number of threads to 5, Ramp-Up Period to 1 second, and Loop Count to 2.' },
      { name: 'Add Default HTTP Request Properties', text: 'Select the Thread Group, right-click Add then Config Element then HTTP Request Defaults. Enter the server name (e.g. jmeter.apache.org) so all HTTP requests use it as the default.' },
      { name: 'Add Cookie Support', text: 'Select the Thread Group, right-click Add then Config Element then HTTP Cookie Manager. This ensures each thread gets its own cookies, shared across all HTTP Request objects.' },
      { name: 'Add HTTP Requests', text: 'Right-click the Thread Group, Add then Sampler then HTTP Request. Add a first request named Home Page with path /, and a second named Changes with path /changes.html.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the JMeter Users element, Add then Listener then Graph Results. This listener stores all results of your HTTP requests and presents a visual model of the data.' },
      { name: 'Log in to a Web Site', text: 'If the site requires login, add an HTTP Request with method set to POST. Set the path to the form submit target, add the username and password parameters, and include any hidden form fields.' },
      { name: 'Choose Same or Different Users', text: 'On the Thread Group element, configure whether to simulate the same user running multiple iterations or different users running one iteration. Control Cookie Manager, Cache Manager, and Authorization Manager via this setting.' },
    ],
  },

  '/user-manual/build-adv-web-test-plan': {
    name: 'How to Build an Advanced Web Test Plan in JMeter',
    description: 'Create advanced JMeter test plans for web sites with URL rewriting and custom HTTP headers.',
    step: [
      { name: 'Handle User Sessions with URL Rewriting', text: 'Add an HTTP URL Re-writing Modifier to a SimpleController. Enter the name of your session ID parameter and it will find it in the HTML response and add it to each request. Check Cache Session Id to save the last found session ID.' },
      { name: 'Use a Header Manager', text: 'Add an HTTP Header Manager at the Thread Group level to customize HTTP request headers such as User-Agent, Pragma, and Referer. Add it at the Thread Group level unless you need different headers per request.' },
    ],
  },

  '/user-manual/build-db-test-plan': {
    name: 'How to Build a Database Test Plan in JMeter',
    description: 'Create a JMeter test plan to test a database server with JDBC requests.',
    step: [
      { name: 'Add Users with a Thread Group', text: 'Select the Test Plan, right-click Add then ThreadGroup. Name it JDBC Users, set 50 threads, Ramp-Up Period to 10 seconds, and Loop Count to 100. Copy your database driver JAR to the JMeter lib directory.' },
      { name: 'Add JDBC Requests', text: 'Add a JDBC Connection Configuration with a variable name like myDatabase, database URL, driver class, username, and password. Then add JDBC Request samplers with SQL queries, referencing the connection pool variable name.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the JDBC Users element, Add then Listener then Summary Report. Save the test plan and run it with Run then Start or Ctrl+R. The listener displays the results.' },
    ],
  },

  '/user-manual/build-ftp-test-plan': {
    name: 'How to Build an FTP Test Plan in JMeter',
    description: 'Create a JMeter test plan to test an FTP site with multiple users downloading files.',
    step: [
      { name: 'Add Users with a Thread Group', text: 'Select the Test Plan, right-click Add then ThreadGroup. Name it FTP Users, set 4 threads, Ramp-Up Period to 0 seconds, and Loop Count to 2 for a total of 16 FTP requests.' },
      { name: 'Add Default FTP Request Properties', text: 'Select the FTP Users element, Add then Config Element then FTP Request Defaults. Enter the FTP server name (e.g. ftp.domain.com) so all FTP requests use it as the default.' },
      { name: 'Add FTP Requests', text: 'Add FTP Request samplers to the Thread Group. Create a first request named File1 with remote file /directory/file1.txt, and a second named File2 with /directory/file2.txt. Set username to anonymous and password to anonymous@test.com.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the FTP Users element, Add then Listener then View Results in Table. Run your test and view the results in the table listener.' },
    ],
  },

  '/user-manual/build-ldap-test-plan': {
    name: 'How to Build an LDAP Test Plan in JMeter',
    description: 'Create a JMeter test plan to test an LDAP server with add, search, modify, and delete operations.',
    step: [
      { name: 'Add Users with a Thread Group', text: 'Select the Test Plan, right-click Add then ThreadGroup. Name it LDAP Users and configure the number of threads and loop count for your test.' },
      { name: 'Add Login Config Element', text: 'Select the LDAP Users element, Add then Config Element then Login Config Element. Enter your LDAP username and password. These values will be used by the LDAP Requests.' },
      { name: 'Add LDAP Request Defaults', text: 'Add an LDAP Request Defaults config element. Enter the DN field with your LDAP Root Distinguished Name, the Servername as ldap.test.com, and the port as 389. These are defaults for all LDAP Requests.' },
      { name: 'Add LDAP Requests', text: 'Add four LDAP Request samplers: an Add Test, Search Test, Modify Test, and Delete Test. For each, select the appropriate radio button in the Test Configuration group and rename the element accordingly.' },
      { name: 'Add a Response Assertion', text: 'Add a Response Assertion element. Select Text Response, choose Substring pattern matching, and add the string successful as the pattern to test. This assertion executes for each LDAP Request.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the LDAP Users element, Add then Listener then View Results in Table. This listener stores all results and presents a visual model of the data.' },
    ],
  },

  '/user-manual/build-ldapext-test-plan': {
    name: 'How to Build an Extended LDAP Test Plan in JMeter',
    description: 'Create a JMeter test plan to test an LDAP server using the highly configurable Extended LDAP Sampler with nine operations.',
    step: [
      { name: 'Add Users with a Thread Group', text: 'Select the Test Plan, right-click Add then Threads (Users) then Thread Group. Name it LDAP Ext Users and configure threads and loop count for your test.' },
      { name: 'Add LDAP Extended Request Defaults', text: 'Select the LDAP Ext Users element, Add then Config Element then LDAP Extended Request Defaults. You can fill in default values for each operation type, or leave them empty and specify values per request.' },
      { name: 'Add LDAP Extended Requests', text: 'Add nine LDAP Ext Request samplers in order: Thread bind, Search Test, Compare Test, Single bind/unbind Test, Add Test, Modify Test, Rename entry (moddn), Delete Test, and Thread unbind. Configure each with the appropriate operation button and parameters.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the Thread Group element, Add then Listener then View Results Tree. The listener has three tabs: sampler result, request, and response data with full XML details.' },
    ],
  },

  '/user-manual/build-ws-test-plan': {
    name: 'How to Build a SOAP WebService Test Plan in JMeter',
    description: 'Create a JMeter test plan to test a SOAP or REST web service using HTTP requests.',
    step: [
      { name: 'Create the WebService Test Plan from a Template', text: 'Use File then Templates and select Building a SOAP Webservice Test Plan, then click Create. In HTTP Request Defaults, change the Server Name. In the Soap Request, change the Path. Update the SOAPAction header in the HTTP Header Manager to match your webservice.' },
      { name: 'Add Users with a Thread Group', text: 'Select the Thread Group, name it JMeter Users, set 10 threads, Ramp-Up Period to 0 seconds, and Loop Count to 2. Paste the SOAP message in the Body Data text area of the Soap Request sampler.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the JMeter Users element, Add then Listener then Aggregate Graph. Specify an output file directory and filename to store the results.' },
      { name: 'Test a REST Webservice', text: 'Modify the HTTP Request Method to the one you want to test, set the Body Data to JSON, XML, or custom text, and update the HTTP Header Manager Content-Type header as needed.' },
    ],
  },

  '/user-manual/build-jms-point-to-point-test-plan': {
    name: 'How to Build a JMS Point-to-Point Test Plan in JMeter',
    description: 'Create a JMeter test plan to test a JMS Point-to-Point messaging solution with request and reply queues.',
    step: [
      { name: 'Add a Thread Group', text: 'Select the Test Plan, right-click Add then ThreadGroup. Name it Point-to-Point, set 5 threads, Ramp-Up Period to 0 seconds, and Loop Count to 4. Ensure required JMS JAR files are in the JMeter lib directory.' },
      { name: 'Add JMS Point-to-Point Sampler', text: 'Add a JMS Point-to-Point sampler to the Thread Group. Configure the QueueConnectionFactory, JNDI names for request and reply queues, communication style as Request Response, and JNDI properties for your JMS provider such as ActiveMQ.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the Thread Group element, Add then Listener then Graph Results. Specify a directory and filename for the output file to store and visualize the results.' },
    ],
  },

  '/user-manual/build-jms-topic-test-plan': {
    name: 'How to Build a JMS Topic Test Plan in JMeter',
    description: 'Create a JMeter test plan to test JMS Providers with pub/sub messaging using subscribers and a publisher.',
    step: [
      { name: 'Add Users with Thread Groups', text: 'Add two Thread Groups. Name the first Subscribers with 5 threads and Loop Count 10. Name the second Publisher with 1 thread and Loop Count 10. Ensure JMS JAR files are in the JMeter lib directory.' },
      { name: 'Add JMS Subscriber and Publisher', text: 'Add a JMS Subscriber to the Subscribers element and configure the InitialContextFactory, provider URL, connection factory, and topic name. Add a JMS Publisher to the Publisher element with similar configuration and select the message source and type.' },
      { name: 'Add a Listener to View Test Results', text: 'Select the Test Plan element, Add then Listener then Graph Results. Specify a directory and filename for the output file to store and visualize the results.' },
    ],
  },

  '/user-manual/build-monitor-test-plan': {
    name: 'How to Build a Monitor Test Plan in JMeter',
    description: 'Create a JMeter test plan to monitor web servers. Note: this feature was removed since JMeter 3.2.',
    step: [
      { name: 'Add a Server with a Thread Group', text: 'Add a Thread Group with exactly 1 thread, since JMeter is used as a monitor. Set the loop count to Forever or a large number to generate enough samples.' },
      { name: 'Add HTTP Authorization Manager', text: 'Add an HTTP Authorization Manager to the Thread Group. Leave the base URL blank, and enter the username and password for your webserver.' },
      { name: 'Add HTTP Request', text: 'Add an HTTP Request sampler. Name it Server Status, enter the IP address or hostname, port number, set the path to /manager/status for Tomcat, add a request parameter named XML with value true, and check Use as Monitor.' },
      { name: 'Add a Constant Timer', text: 'Add a Constant Timer to the Thread Group with 5000 milliseconds. Using intervals shorter than 5 seconds will add stress to your server.' },
      { name: 'Add a Listener to Store Results', text: 'Add a Simple Data Writer listener to save raw results. Specify a directory and filename for the output file to store both raw data and calculated statistics.' },
      { name: 'Add Monitor Results Listener', text: 'Add a Monitor Results listener to the Test Plan. It displays a Health tab showing server status and a Performance tab with a historical view of server performance.' },
    ],
  },

  '/user-manual/build-programmatic-test-plan': {
    name: 'How to Build a JMeter Test Plan Programmatically',
    description: 'Create JMeter test plans using low-level APIs, Kotlin DSL, and Java DSL introduced in JMeter 5.6.',
    step: [
      { name: 'Create a Plan with Low-Level APIs', text: 'Use ListedHashTree to build the tree. Create a TestPlan, add it to the root tree, then add a ThreadGroup under it, and add samplers like DebugSampler under the thread group. Do not use HashTree as it does not honour element order.' },
      { name: 'Generate Code from the UI', text: 'Use the Copy Code context action on any element in the JMeter plan tree to generate Kotlin DSL code for that element and its children. This helps bootstrap programmatic test plan creation.' },
      { name: 'Create a Plan with Kotlin DSL', text: 'Use the testTree builder function. Add elements with class references like TestPlan::class and ThreadGroup::class. Use the unary plus operator to append childless elements, or pass instances directly.' },
      { name: 'Extend the Kotlin DSL', text: 'Factor out common patterns as extension functions on TreeBuilder. For example, create a threadGroup function with default parameters for name, numThreads, and rampUp, then call it inside the testTree builder.' },
      { name: 'Create a Plan with Java DSL', text: 'Use the testTree builder with a builder lambda. Add elements with b.add(Class, consumer) calls. The lambda parameter corresponds to the added element for property configuration. Add TestElement instances directly or via class reference.' },
    ],
  },

  '/user-manual/remote-test': {
    name: 'How to Set Up Remote (Distributed) Testing in JMeter',
    description: 'Configure and run distributed JMeter tests across multiple remote servers from a single client.',
    step: [
      { name: 'Configure the Nodes', text: 'Ensure all nodes run the same JMeter version and Java version. Set up a valid keystore for RMI over SSL or disable SSL. Copy any data files to each server since they are not sent by the client.' },
      { name: 'Start the Servers', text: 'Run jmeter-server on Unix or jmeter-server.bat on Windows on each remote machine. The JMeter server starts the RMI registry itself. Use server.rmi.localport to control the port if needed for firewalls.' },
      { name: 'Add Server IPs to Client Properties', text: 'Edit jmeter.properties on the controlling machine and add server IP addresses to the remote_hosts property, comma-delimited. Alternatively, use the -R command line option to specify remote hosts.' },
      { name: 'Start the JMeter Client', text: 'Start the client with jmeter.bat on Windows or jmeter on Unix. Use Remote Start and Remote Stop from the Run menu in GUI mode, or use jmeter -n -t script.jmx -r in CLI mode for remote test execution.' },
    ],
  },

  '/reference/building': {
    name: 'How to Build and Contribute to JMeter',
    description: 'Build JMeter from source using Gradle and contribute patches via GitHub pull requests.',
    step: [
      { name: 'Acquire the Source', text: 'Download the official source releases from the Apache JMeter download page, or clone the Git repository from GitHub.' },
      { name: 'Compile and Package with Gradle', text: 'Run ./gradlew build to compile and package JMeter. Use ./gradlew tasks to see all available tasks. A Java 17 compatible JDK is required.' },
      { name: 'Open the Project in IntelliJ IDEA', text: 'Open the build.gradle.kts file with IntelliJ IDEA, select Open as Project, enable Create separate module per source set and Use default gradle wrapper.' },
      { name: 'Check Your Patch', text: 'Run ./gradlew check to verify compilation and tab space policy. Run ./gradlew test to ensure JUnit tests pass.' },
      { name: 'Create a Pull Request', text: 'Fork the Apache JMeter mirror on GitHub, clone your fork, create a branch, commit your fix, push it, and create a pull request. Avoid merge commits in the PR.' },
    ],
  },

  '/reference/creating-templates': {
    name: 'How to Create Customizable JMeter Templates',
    description: 'Create custom JMeter test plan templates with user-configurable parameters using Freemarker syntax.',
    step: [
      { name: 'Set Up the Folder Structure', text: 'Use the bin/templates folder which contains templates.xml for declarations and .jmx or .jmx.fmkr files for the templates themselves.' },
      { name: 'Declare a Basic Template', text: 'In templates.xml, add a template element with name, fileName, and description tags. The fileName points to the relative path of your .jmx template file.' },
      { name: 'Declare a Customizable Template', text: 'Add a parameters tag with parameter tags inside, each having a key and defaultValue attribute. Rename your template file from .jmx to .jmx.fmkr to enable Freemarker processing.' },
      { name: 'Create the Template File', text: 'In the .jmx.fmkr file, replace hardcoded values with custom tags using Freemarker alternative interpolation syntax like [=xmlFileName]. JMeter will ask the user for the parameter value and substitute it in the created template.' },
    ],
  },
};

/**
 * Build a HowTo JSON-LD object for a given pathname, or null if no HowTo
 * entries exist for that page.
 */
export function buildHowToJsonLd(pathname, canonicalUrl) {
  const key = pathname.replace(/\/$/, '') || '/';
  const entry = howtoSchema[key];
  if (!entry || !entry.step || entry.step.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: entry.name,
    description: entry.description,
    url: canonicalUrl,
    step: entry.step.map((s) => ({
      '@type': 'HowToStep',
      name: s.name,
      text: s.text,
    })),
  };
}
