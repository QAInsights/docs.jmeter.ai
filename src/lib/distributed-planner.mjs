/**
 * Pure logic for the JMeter Distributed Testing Port & Firewall Planner.
 * Generates exact configuration properties, CLI commands, firewall rules,
 * verification scripts, and Docker Compose manifests for Master-Worker clusters.
 */

import { DISTRIBUTED_PLANNER } from './tools-config.mjs';
import { clampToRange, readBoolFlag, readClampedNumber } from './tools-utils.mjs';

/**
 * @typedef {{
 *   controllerIp: string,
 *   workerIps: string,
 *   serverPort: number,
 *   serverRmiLocalPort: number,
 *   clientRmiLocalPort: number,
 *   disableSsl: boolean,
 *   mode: 'StrippedBatch' | 'Statistical' | 'Batch' | 'Standard',
 *   environment: 'aws' | 'azure' | 'gcp' | 'linux' | 'docker' | 'k8s'
 * }} DistributedPlannerState
 */

/**
 * @typedef {{
 *   direction: 'Inbound' | 'Outbound',
 *   source: string,
 *   destination: string,
 *   protocol: 'TCP',
 *   port: number,
 *   purpose: string
 * }} FirewallRule
 */

/**
 * Clean and parse IP list from comma/space/newline separated input.
 * @param {string} raw
 * @returns {string[]}
 */
export function parseIpList(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter((ip) => /^[A-Za-z0-9._:\-\[\]]+$/.test(ip));
}

/**
 * Sanitize single IP/hostname.
 * @param {string} ip
 * @param {string} fallback
 * @returns {string}
 */
export function sanitizeHost(ip, fallback) {
  const s = String(ip || '').trim();
  if (!s || !/^[A-Za-z0-9._:\-\[\]]+$/.test(s)) return fallback;
  return s.slice(0, DISTRIBUTED_PLANNER.limits.ipMaxLen);
}

/**
 * Generate full distributed topology plan and configuration artifacts.
 * @param {Partial<DistributedPlannerState>} input
 */
export function generateDistributedPlan(input = {}) {
  const defaults = DISTRIBUTED_PLANNER.defaults;
  const limits = DISTRIBUTED_PLANNER.limits;

  const controllerIp = sanitizeHost(input.controllerIp, defaults.controllerIp);
  const workers = parseIpList(input.workerIps || defaults.workerIps);
  const safeWorkers = workers.length > 0 ? workers.slice(0, limits.maxWorkers) : parseIpList(defaults.workerIps);

  const serverPort = clampToRange(Number(input.serverPort) || defaults.serverPort, limits.port);
  const serverRmiLocalPort = clampToRange(Number(input.serverRmiLocalPort) || defaults.serverRmiLocalPort, limits.port);
  const clientRmiLocalPort = clampToRange(Number(input.clientRmiLocalPort) || defaults.clientRmiLocalPort, limits.port);

  const disableSsl = Boolean(input.disableSsl);
  const mode = DISTRIBUTED_PLANNER.transmissionModes.includes(input.mode || '')
    ? /** @type {DistributedPlannerState['mode']} */ (input.mode)
    : defaults.mode;

  const remoteHostsValue = safeWorkers.map((ip) => `${ip}:${serverPort}`).join(',');
  const remoteHostsShort = safeWorkers.join(',');

  // Controller configuration
  const controllerUserProperties = [
    '# =========================================================================',
    '# JMeter Controller (Master) user.properties',
    '# =========================================================================',
    `remote_hosts=${remoteHostsValue}`,
    `client.rmi.localport=${clientRmiLocalPort}`,
    `mode=${mode}`,
    `server.rmi.ssl.disable=${disableSsl}`,
    '# java.rmi.server.hostname should match controller reachable VPC/LAN IP',
    `java.rmi.server.hostname=${controllerIp}`,
  ].join('\n');

  const controllerCliCommand = [
    'jmeter -n -t test.jmx \\',
    `  -R ${remoteHostsShort} \\`,
    `  -Djava.rmi.server.hostname=${controllerIp} \\`,
    `  -Dclient.rmi.localport=${clientRmiLocalPort} \\`,
    `  -Dserver.rmi.ssl.disable=${disableSsl} \\`,
    '  -l results.jtl -e -o ./report',
  ].join('\n');

  // Worker configuration
  const workerUserProperties = [
    '# =========================================================================',
    '# JMeter Worker (Server / Injector) user.properties',
    '# =========================================================================',
    `server_port=${serverPort}`,
    `server.rmi.localport=${serverRmiLocalPort}`,
    `server.rmi.ssl.disable=${disableSsl}`,
  ].join('\n');

  const workerCommands = safeWorkers.map((workerIp) => ({
    ip: workerIp,
    startupCommand: `./bin/jmeter-server -Djava.rmi.server.hostname=${workerIp} -Dserver_port=${serverPort} -Dserver.rmi.localport=${serverRmiLocalPort} -Dserver.rmi.ssl.disable=${disableSsl}`,
  }));

  /** @type {FirewallRule[]} */
  const firewallRules = [];

  // Rules on Worker Nodes (Inbound from Controller)
  firewallRules.push({
    direction: 'Inbound',
    source: controllerIp,
    destination: `Workers (${safeWorkers.join(', ')})`,
    protocol: 'TCP',
    port: serverPort,
    purpose: 'RMI Registry port (Controller calls Worker to register)',
  });
  firewallRules.push({
    direction: 'Inbound',
    source: controllerIp,
    destination: `Workers (${safeWorkers.join(', ')})`,
    protocol: 'TCP',
    port: serverRmiLocalPort,
    purpose: 'RMI Server engine port (Controller sends test plan & commands)',
  });

  // Rules on Controller Node (Inbound from Workers)
  firewallRules.push({
    direction: 'Inbound',
    source: `Workers (${safeWorkers.join(', ')})`,
    destination: controllerIp,
    protocol: 'TCP',
    port: clientRmiLocalPort,
    purpose: 'RMI Callback port (Workers stream sample results back to Controller)',
  });

  // Verification scripts
  const bashVerification = [
    '# 1. On Controller: Test connectivity to Workers',
    ...safeWorkers.map((w) => `nc -zv ${w} ${serverPort} && nc -zv ${w} ${serverRmiLocalPort}`),
    '',
    '# 2. On each Worker: Test callback connectivity to Controller',
    `nc -zv ${controllerIp} ${clientRmiLocalPort}`,
  ].join('\n');

  const psVerification = [
    '# 1. On Controller (PowerShell): Test connectivity to Workers',
    ...safeWorkers.flatMap((w) => [
      `Test-NetConnection -ComputerName "${w}" -Port ${serverPort}`,
      `Test-NetConnection -ComputerName "${w}" -Port ${serverRmiLocalPort}`,
    ]),
    '',
    '# 2. On each Worker (PowerShell): Test callback connectivity to Controller',
    `Test-NetConnection -ComputerName "${controllerIp}" -Port ${clientRmiLocalPort}`,
  ].join('\n');

  // Environment-specific security group / firewall commands
  const env = input.environment || defaults.environment;
  let envSnippet = '';

  if (env === 'aws') {
    envSnippet = [
      '# AWS Security Group CLI rules',
      `aws ec2 authorize-security-group-ingress --group-id <sg-workers> --protocol tcp --port ${serverPort} --cidr ${controllerIp}/32 --description "JMeter RMI Registry"`,
      `aws ec2 authorize-security-group-ingress --group-id <sg-workers> --protocol tcp --port ${serverRmiLocalPort} --cidr ${controllerIp}/32 --description "JMeter Worker Engine"`,
      `aws ec2 authorize-security-group-ingress --group-id <sg-controller> --protocol tcp --port ${clientRmiLocalPort} --cidr <workers-subnet-cidr> --description "JMeter Sample Callback"`,
    ].join('\n');
  } else if (env === 'azure') {
    envSnippet = [
      '# Azure Network Security Group (NSG) CLI rules',
      `az network nsg rule create -g <resource-group> --nsg-name <worker-nsg> -n Allow-JMeter-RMI --priority 100 --source-address-prefixes ${controllerIp} --destination-port-ranges ${serverPort} ${serverRmiLocalPort} --protocol Tcp --access Allow`,
      `az network nsg rule create -g <resource-group> --nsg-name <controller-nsg> -n Allow-JMeter-Callback --priority 100 --source-address-prefixes <workers-subnet> --destination-port-ranges ${clientRmiLocalPort} --protocol Tcp --access Allow`,
    ].join('\n');
  } else if (env === 'gcp') {
    envSnippet = [
      '# Google Cloud Platform (GCP) Firewall rules',
      `gcloud compute firewall-rules create allow-jmeter-workers --allow tcp:${serverPort},tcp:${serverRmiLocalPort} --source-ranges ${controllerIp}/32 --description "Allow JMeter Controller to Workers"`,
      `gcloud compute firewall-rules create allow-jmeter-controller --allow tcp:${clientRmiLocalPort} --source-ranges <workers-subnet-cidr> --description "Allow Workers to Controller Callback"`,
    ].join('\n');
  } else if (env === 'k8s') {
    envSnippet = [
      '# Kubernetes Headless Service (Worker DNS discovery)',
      'apiVersion: v1',
      'kind: Service',
      'metadata:',
      '  name: jmeter-worker-service',
      'spec:',
      '  clusterIP: None',
      '  selector:',
      '    app: jmeter-worker',
      '  ports:',
      `    - name: rmi-registry\n      port: ${serverPort}`,
      `    - name: rmi-server\n      port: ${serverRmiLocalPort}`,
    ].join('\n');
  } else if (env === 'docker') {
    envSnippet = [
      '# Docker Bridge Network & Port Mapping',
      'docker network create jmeter-net',
      `# Controller port binding: -p ${clientRmiLocalPort}:${clientRmiLocalPort}`,
      `# Worker port bindings: -p ${serverPort}:${serverPort} -p ${serverRmiLocalPort}:${serverRmiLocalPort}`,
      '# See the "Docker Compose" tab for the complete cluster definition.',
    ].join('\n');
  } else {
    envSnippet = [
      '# Linux UFW / iptables rules',
      `sudo ufw allow from ${controllerIp} to any port ${serverPort} proto tcp comment "JMeter RMI Registry"`,
      `sudo ufw allow from ${controllerIp} to any port ${serverRmiLocalPort} proto tcp comment "JMeter Worker Engine"`,
      `sudo ufw allow proto tcp to any port ${clientRmiLocalPort} comment "JMeter Return Callback"`,
    ].join('\n');
  }


  // Docker Compose snippet
  const dockerWorkersRemote = safeWorkers.map((_, idx) => `jmeter-worker-${idx + 1}:${serverPort}`).join(',');
  const dockerCompose = [
    'services:',
    '  jmeter-master:',
    '    image: justb4/jmeter:5.6.3',
    `    command: ["-n", "-t", "/plans/test.jmx", "-R", "${dockerWorkersRemote}", "-l", "/results/results.jtl", "-e", "-o", "/results/report"]`,
    '    environment:',
    `      - "JVM_ARGS=-Djava.rmi.server.hostname=jmeter-master -Dclient.rmi.localport=${clientRmiLocalPort} -Dserver.rmi.ssl.disable=${disableSsl}"`,
    '    ports:',
    `      - "${clientRmiLocalPort}:${clientRmiLocalPort}"`,
    '    volumes:',
    '      - ./plans:/plans',
    '      - ./results:/results',
    ...safeWorkers.map((_, idx) => [
      `  jmeter-worker-${idx + 1}:`,
      '    image: justb4/jmeter:5.6.3',
      '    command: ["-s"]',
      '    environment:',
      `      - "JVM_ARGS=-Djava.rmi.server.hostname=jmeter-worker-${idx + 1} -Dserver_port=${serverPort} -Dserver.rmi.localport=${serverRmiLocalPort} -Dserver.rmi.ssl.disable=${disableSsl}"`,
      '    ports:',
      `      - "${serverPort}:${serverPort}"`,
      `      - "${serverRmiLocalPort}:${serverRmiLocalPort}"`,
    ].join('\n')),
  ].join('\n');

  return {
    state: {
      controllerIp,
      workerIps: safeWorkers.join(', '),
      serverPort,
      serverRmiLocalPort,
      clientRmiLocalPort,
      disableSsl,
      mode,
      environment: env,
    },
    summary: {
      workerCount: safeWorkers.length,
      totalNodes: safeWorkers.length + 1,
      pinnedPorts: [serverPort, serverRmiLocalPort, clientRmiLocalPort],
      firewallRulesCount: firewallRules.length,
      sslEnabled: !disableSsl,
    },
    controller: {
      ip: controllerIp,
      userProperties: controllerUserProperties,
      cliCommand: controllerCliCommand,
    },
    worker: {
      userProperties: workerUserProperties,
      instances: workerCommands,
    },
    firewallRules,
    envSnippet,
    verification: {
      bash: bashVerification,
      powershell: psVerification,
    },
    dockerCompose,
    notes: [
      `Always set java.rmi.server.hostname on both controller (${controllerIp}) and workers (${safeWorkers.join(', ')}) to avoid 127.0.0.1 loopback stub errors.`,
      `Pinned client.rmi.localport (${clientRmiLocalPort}) and server.rmi.localport (${serverRmiLocalPort}) allow you to lock down firewalls without allowing random ephemeral port ranges.`,
      disableSsl
        ? 'RMI SSL is disabled. Recommended only for isolated lab environments or private VPC subnets.'
        : 'RMI SSL is enabled. Ensure bin/create-rmi-keystore has been executed and rmi_keystore.jks is copied to the bin/ directory on all nodes.',
    ],
  };
}

/**
 * Parse URL query parameters into state object.
 * @param {URLSearchParams} params
 * @returns {DistributedPlannerState}
 */
export function parseDistributedPlannerParams(params) {
  const def = DISTRIBUTED_PLANNER.defaults;
  const lim = DISTRIBUTED_PLANNER.limits;

  const controllerIp = sanitizeHost(params.get('c_ip') || '', def.controllerIp);
  const workerIps = params.get('w_ips') || def.workerIps;
  const serverPort = readClampedNumber(params, 's_port', lim.port, def.serverPort);
  const serverRmiLocalPort = readClampedNumber(params, 'sr_port', lim.port, def.serverRmiLocalPort);
  const clientRmiLocalPort = readClampedNumber(params, 'cr_port', lim.port, def.clientRmiLocalPort);
  const disableSsl = readBoolFlag(params, 'no_ssl');
  const mode = DISTRIBUTED_PLANNER.transmissionModes.includes(params.get('mode') || '')
    ? /** @type {DistributedPlannerState['mode']} */ (params.get('mode'))
    : def.mode;
  const environment = ['aws', 'azure', 'gcp', 'linux', 'docker', 'k8s'].includes(params.get('env') || '')
    ? /** @type {DistributedPlannerState['environment']} */ (params.get('env'))
    : def.environment;

  return {
    controllerIp,
    workerIps,
    serverPort,
    serverRmiLocalPort,
    clientRmiLocalPort,
    disableSsl,
    mode,
    environment,
  };
}

/**
 * Serialize state object to URL query string.
 * @param {DistributedPlannerState} s
 * @returns {string}
 */
export function serializeDistributedPlannerParams(s) {
  const p = new URLSearchParams();
  p.set('c_ip', s.controllerIp);
  p.set('w_ips', s.workerIps);
  p.set('s_port', String(s.serverPort));
  p.set('sr_port', String(s.serverRmiLocalPort));
  p.set('cr_port', String(s.clientRmiLocalPort));
  if (s.disableSsl) p.set('no_ssl', '1');
  if (s.mode !== DISTRIBUTED_PLANNER.defaults.mode) p.set('mode', s.mode);
  if (s.environment !== DISTRIBUTED_PLANNER.defaults.environment) p.set('env', s.environment);
  return p.toString();
}

