/**
 * Pure logic for the Linux Kernel / OS Tuning (sysctl.conf & limits.conf) Configurator.
 * Generates production-ready sysctl.conf, limits.conf, systemd configs, Docker/K8s manifests,
 * and diagnostic verification scripts tuned for high-concurrency JMeter load injectors.
 */

import { OS_TUNING } from './tools-config.mjs';
import { clampToRange, readClampedNumber } from './tools-utils.mjs';

/**
 * @typedef {{
 *   concurrency: number,
 *   ramGb: number,
 *   trafficType: 'http_churn' | 'http_keepalive' | 'streaming_ws_grpc',
 *   targetDistro: 'ubuntu_debian' | 'rhel_rocky' | 'amazon_linux' | 'docker_k8s',
 *   role: 'injector' | 'target_sut'
 * }} OsTuningState
 */

/**
 * Sanitize and clamp state values against bounds.
 * @param {Partial<OsTuningState>} input
 * @returns {OsTuningState}
 */
export function sanitizeOsTuningState(input = {}) {
  const defaults = OS_TUNING.defaults;
  const limits = OS_TUNING.limits;

  const concurrency = clampToRange(Number(input.concurrency) || defaults.concurrency, limits.concurrency);
  const ramGb = clampToRange(Number(input.ramGb) || defaults.ramGb, limits.ramGb);

  const trafficType = OS_TUNING.trafficTypes.some((t) => t.id === input.trafficType)
    ? /** @type {OsTuningState['trafficType']} */ (input.trafficType)
    : defaults.trafficType;

  const targetDistro = OS_TUNING.targetDistros.some((d) => d.id === input.targetDistro)
    ? /** @type {OsTuningState['targetDistro']} */ (input.targetDistro)
    : defaults.targetDistro;

  const role = OS_TUNING.roles.some((r) => r.id === input.role)
    ? /** @type {OsTuningState['role']} */ (input.role)
    : defaults.role;

  return { concurrency, ramGb, trafficType, targetDistro, role };
}

/**
 * Calculate optimal kernel and system parameters from input state.
 * @param {OsTuningState} state
 */
export function calculateKernelMetrics(state) {
  const { concurrency, ramGb, trafficType, role } = state;

  // File descriptors
  let nofile = 65536;
  if (concurrency >= 50000) {
    nofile = 1048576;
  } else if (concurrency >= 10000) {
    nofile = 524288;
  } else {
    nofile = Math.max(65536, concurrency * 8);
  }

  const fileMax = Math.max(2097152, nofile * 2);
  const nrOpen = Math.max(2097152, nofile * 2);
  const nproc = concurrency >= 50000 ? 131072 : 65535;

  // Ports and TIME_WAIT
  const portRange = '1024 65535';
  const availablePorts = 65535 - 1024 + 1; // 64,512
  const tcpTwReuse = 1;
  const tcpFinTimeout = trafficType === 'http_churn' ? 15 : 30;
  const tcpMaxTwBuckets = Math.max(262144, concurrency * 8);

  // Queues & Backlog
  const somaxconn = Math.max(65535, Math.min(131072, concurrency * 2));
  const tcpMaxSynBacklog = Math.max(65535, Math.min(131072, concurrency * 2));
  const netdevMaxBacklog = Math.max(65535, Math.min(250000, concurrency * 5));

  // TCP Buffer Memory (scaled with host RAM)
  let rmemMax = 16777216; // 16 MB
  let wmemMax = 16777216;
  let tcpRmem = '4096 87380 16777216';
  let tcpWmem = '4096 65536 16777216';

  if (ramGb >= 64) {
    rmemMax = 67108864; // 64 MB
    wmemMax = 67108864;
    tcpRmem = '4096 87380 67108864';
    tcpWmem = '4096 65536 67108864';
  } else if (ramGb >= 16) {
    rmemMax = 33554432; // 32 MB
    wmemMax = 33554432;
    tcpRmem = '4096 87380 33554432';
    tcpWmem = '4096 65536 33554432';
  }

  // Memory in 4KB pages for tcp_mem: [low, pressure, max]
  const totalPages = (ramGb * 1024 * 1024 * 1024) / 4096;
  const tcpMemLow = Math.round(totalPages * 0.1);
  const tcpMemPressure = Math.round(totalPages * 0.2);
  const tcpMemMax = Math.round(totalPages * 0.35);
  const tcpMem = `${tcpMemLow} ${tcpMemPressure} ${tcpMemMax}`;

  // VM Swappiness and Page Flushing
  const swappiness = role === 'injector' ? 1 : 10;
  const maxMapCount = Math.max(262144, Math.min(1048576, concurrency * 16));
  const dirtyRatio = 15;
  const dirtyBackgroundRatio = 5;

  // Keepalive
  const tcpKeepaliveTime = 300;
  const tcpKeepaliveIntvl = 15;
  const tcpKeepaliveProbes = 5;

  // Connection Tracking (Conntrack)
  const nfConntrackMax = Math.max(524288, concurrency * 10);
  const nfConntrackTcpTimeoutEstablished = 600;
  const nfConntrackTcpTimeoutTimeWait = 30;

  return {
    nofile,
    fileMax,
    nrOpen,
    nproc,
    portRange,
    availablePorts,
    tcpTwReuse,
    tcpFinTimeout,
    tcpMaxTwBuckets,
    somaxconn,
    tcpMaxSynBacklog,
    netdevMaxBacklog,
    rmemMax,
    wmemMax,
    tcpRmem,
    tcpWmem,
    tcpMem,
    swappiness,
    maxMapCount,
    dirtyRatio,
    dirtyBackgroundRatio,
    tcpKeepaliveTime,
    tcpKeepaliveIntvl,
    tcpKeepaliveProbes,
    nfConntrackMax,
    nfConntrackTcpTimeoutEstablished,
    nfConntrackTcpTimeoutTimeWait,
  };
}

/**
 * Generate formatted sysctl configuration with distro-specific context.
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 */
export function generateSysctlSnippet(state, m) {
  const distroHeaders = {
    ubuntu_debian: '# Target: Ubuntu / Debian Linux | File: /etc/sysctl.d/99-jmeter-tuning.conf',
    rhel_rocky: '# Target: RHEL / Rocky Linux / CentOS / AlmaLinux | File: /etc/sysctl.d/99-jmeter-tuning.conf',
    amazon_linux: '# Target: Amazon Linux 2023 / AL2 (EC2) | File: /etc/sysctl.d/99-jmeter-tuning.conf',
    docker_k8s: '# Target: Container Host Node (Apply to Docker/K8s worker nodes before running pods)',
  };

  const distroReload = {
    ubuntu_debian: '# Reload command: sudo sysctl --system (or sudo sysctl -p /etc/sysctl.d/99-jmeter-tuning.conf)',
    rhel_rocky: '# Reload command: sudo sysctl --system && sudo systemctl daemon-reload',
    amazon_linux: '# Reload command: sudo sysctl --system',
    docker_k8s: '# Note: Namespaced sysctls can be passed per-pod; host-wide sysctls apply to the worker node.',
  };

  const lines = [
    '# =============================================================================',
    `# Linux Kernel Tuning for JMeter (${state.role === 'injector' ? 'Load Injector' : 'Target Server'})`,
    `# Target Concurrency: ${state.concurrency.toLocaleString()} conns | Host RAM: ${state.ramGb} GB`,
    distroHeaders[state.targetDistro] || distroHeaders.ubuntu_debian,
    distroReload[state.targetDistro] || distroReload.ubuntu_debian,
    '# =============================================================================',
    '',
    '# --- File Descriptors & Process Capacity ---',
    `fs.file-max = ${m.fileMax}`,
    `fs.nr_open = ${m.nrOpen}`,
    '',
    '# --- Ephemeral Port Range & Socket Recycling ---',
    '# Expands available client ports to 64,512 (default is 32768-60999 = ~28k)',
    `net.ipv4.ip_local_port_range = ${m.portRange}`,
    '# Safe TIME_WAIT socket reuse for outbound connections (timestamp protected)',
    `net.ipv4.tcp_tw_reuse = ${m.tcpTwReuse}`,
    '# Reduce linger time in FIN-WAIT-2 / TIME_WAIT (default 60s)',
    `net.ipv4.tcp_fin_timeout = ${m.tcpFinTimeout}`,
    `net.ipv4.tcp_max_tw_buckets = ${m.tcpMaxTwBuckets}`,
    '',
    '# --- Connection Backlog & Listen Queues ---',
    '# Maximum socket listen queue backlog (prevents connection drops during ramp-up)',
    `net.core.somaxconn = ${m.somaxconn}`,
    '# SYN backlog queue length for incomplete handshakes',
    `net.ipv4.tcp_max_syn_backlog = ${m.tcpMaxSynBacklog}`,
    '# Packet queue on incoming network interface',
    `net.core.netdev_max_backlog = ${m.netdevMaxBacklog}`,
    '',
    '# --- TCP Buffer & Socket Memory Allocation ---',
    '# Maximum socket receive & send buffer sizes (in bytes)',
    `net.core.rmem_max = ${m.rmemMax}`,
    `net.core.wmem_max = ${m.wmemMax}`,
    '# Default socket buffers',
    'net.core.rmem_default = 262144',
    'net.core.wmem_default = 262144',
    '# TCP autotuning buffers (min, default, max bytes)',
    `net.ipv4.tcp_rmem = ${m.tcpRmem}`,
    `net.ipv4.tcp_wmem = ${m.tcpWmem}`,
    '# Global TCP memory vector (min, pressure, max in 4KB pages)',
    `net.ipv4.tcp_mem = ${m.tcpMem}`,
    '',
    '# --- TCP Features & Keepalive ---',
    'net.ipv4.tcp_window_scaling = 1',
    'net.ipv4.tcp_timestamps = 1',
    'net.ipv4.tcp_sack = 1',
    `net.ipv4.tcp_keepalive_time = ${m.tcpKeepaliveTime}`,
    `net.ipv4.tcp_keepalive_intvl = ${m.tcpKeepaliveIntvl}`,
    `net.ipv4.tcp_keepalive_probes = ${m.tcpKeepaliveProbes}`,
    '',
    '# --- Virtual Memory & Swapping ---',
    '# Avoid swapping JVM heap to disk (causes catastrophic 100ms+ GC latency spikes)',
    `vm.swappiness = ${m.swappiness}`,
    '# Allow JVM to allocate ample memory maps for high thread counts',
    `vm.max_map_count = ${m.maxMapCount}`,
    `vm.dirty_ratio = ${m.dirtyRatio}`,
    `vm.dirty_background_ratio = ${m.dirtyBackgroundRatio}`,
    '',
    '# --- Netfilter / Connection Tracking (if iptables/firewalld loaded) ---',
    `net.netfilter.nf_conntrack_max = ${m.nfConntrackMax}`,
    `net.netfilter.nf_conntrack_tcp_timeout_established = ${m.nfConntrackTcpTimeoutEstablished}`,
    `net.netfilter.nf_conntrack_tcp_timeout_time_wait = ${m.nfConntrackTcpTimeoutTimeWait}`,
  ];

  return lines.join('\n');
}

/**
 * Generate formatted limits.conf with distro-specific notes.
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 */
export function generateLimitsSnippet(state, m) {
  const isRhel = state.targetDistro === 'rhel_rocky';
  const isDocker = state.targetDistro === 'docker_k8s';

  const lines = [
    '# =============================================================================',
    `# /etc/security/limits.d/99-jmeter.conf (${state.targetDistro})`,
    '# Increases per-user open file descriptors and max process count.',
    '# Apply changes: Log out and log back in, then verify with `ulimit -n` and `ulimit -u`',
  ];

  if (isRhel) {
    lines.push('# RHEL Note: RHEL/CentOS default /etc/security/limits.d/20-nproc.conf sets * soft nproc 4096.');
    lines.push('# Naming this file 99-jmeter.conf ensures it overrides 20-nproc.conf alphabetically.');
  }

  if (isDocker) {
    lines.push('# Container Note: limits.conf applies to the host; for containers, set --ulimit or daemon.json.');
  }

  lines.push(
    '# =============================================================================',
    '',
    '# Target limits for all users and root session',
    `*          soft    nofile    ${m.nofile}`,
    `*          hard    nofile    ${m.nofile}`,
    `*          soft    nproc     ${m.nproc}`,
    `*          hard    nproc     ${m.nproc}`,
    `root       soft    nofile    ${m.nofile}`,
    `root       hard    nofile    ${m.nofile}`,
    `root       soft    nproc     ${m.nproc}`,
    `root       hard    nproc     ${m.nproc}`,
  );

  return lines.join('\n');
}

/**
 * Generate formatted systemd unit and global limit overrides
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 */
export function generateSystemdSnippet(state, m) {
  const isDropIn = state.targetDistro === 'rhel_rocky' || state.targetDistro === 'amazon_linux';
  const filePath = isDropIn
    ? '/etc/systemd/system.conf.d/99-jmeter-limits.conf'
    : '/etc/systemd/system.conf and /etc/systemd/user.conf';

  const lines = [
    '# =============================================================================',
    '# Modern systemd ignores /etc/security/limits.conf for services & sessions.',
    `# Location: ${filePath}`,
    '# Reload systemd: sudo systemctl daemon-reexec && sudo systemctl daemon-reload',
    '# =============================================================================',
    '',
    '[Manager]',
    `DefaultLimitNOFILE=${m.nofile}`,
    `DefaultLimitNPROC=${m.nproc}`,
    'DefaultLimitMEMLOCK=infinity',
    '',
    '# --- Dedicated JMeter Service (e.g. /etc/systemd/system/jmeter-server.service) ---',
    '[Service]',
    `LimitNOFILE=${m.nofile}`,
    `LimitNPROC=${m.nproc}`,
    'LimitMEMLOCK=infinity',
    'TasksMax=infinity',
  ];

  return lines.join('\n');
}

/**
 * Generate Docker CLI & Kubernetes Pod sysctl specifications
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 */
export function generateDockerK8sSnippet(state, m) {
  const reqMemGb = Math.max(2, Math.round(state.ramGb * 0.75));
  const limitMemGb = state.ramGb;
  const reqCpu = Math.max(1, Math.min(8, Math.round(state.concurrency / 5000))) || 2;
  const limitCpu = Math.max(2, Math.min(16, Math.round(state.concurrency / 2500))) || 4;

  const lines = [
    '# =============================================================================',
    '# Docker CLI Flags & Kubernetes Pod Manifest',
    '# =============================================================================',
    '',
    '# --- 1. Docker Run (CLI Flags) ---',
    'docker run -d \\',
    `  --ulimit nofile=${m.nofile}:${m.nofile} \\`,
    `  --ulimit nproc=${m.nproc}:${m.nproc} \\`,
    `  --sysctl net.ipv4.ip_local_port_range="${m.portRange}" \\`,
    `  --sysctl net.ipv4.tcp_tw_reuse=${m.tcpTwReuse} \\`,
    `  --sysctl net.ipv4.tcp_fin_timeout=${m.tcpFinTimeout} \\`,
    `  --sysctl net.core.somaxconn=${m.somaxconn} \\`,
    '  --name jmeter-runner \\',
    '  justb4/jmeter:5.6.3',
    '',
    '# --- 2. Kubernetes Pod Manifest ---',
    '# IMPORTANT K8S SYSCTL NOTES:',
    '# - "net.ipv4.ip_local_port_range" is a SAFE namespaced sysctl (allowed by default).',
    '# - "net.ipv4.tcp_tw_reuse", "net.ipv4.tcp_fin_timeout", and "net.core.somaxconn" are',
    '#   UNSAFE sysctls in standard Kubernetes. Kubelet will reject the Pod unless',
    '#   configured with: --allowed-unsafe-sysctls="net.core.somaxconn,net.ipv4.tcp_tw_reuse,net.ipv4.tcp_fin_timeout"',
    '# Alternatively, configure host-level sysctls via a privileged DaemonSet/initContainer.',
    'apiVersion: v1',
    'kind: Pod',
    'metadata:',
    '  name: jmeter-injector',
    'spec:',
    '  securityContext:',
    '    sysctls:',
    '      # Safe sysctl (default allowed):',
    `      - name: net.ipv4.ip_local_port_range`,
    `        value: "${m.portRange}"`,
    '      # Unsafe sysctls (require kubelet --allowed-unsafe-sysctls):',
    `      - name: net.ipv4.tcp_tw_reuse`,
    `        value: "${m.tcpTwReuse}"`,
    `      - name: net.ipv4.tcp_fin_timeout`,
    `        value: "${m.tcpFinTimeout}"`,
    `      - name: net.core.somaxconn`,
    `        value: "${m.somaxconn}"`,
    '  containers:',
    '    - name: jmeter',
    '      image: justb4/jmeter:5.6.3',
    '      resources:',
    '        requests:',
    `          cpu: "${reqCpu}"`,
    `          memory: "${reqMemGb}Gi"`,
    '        limits:',
    `          cpu: "${limitCpu}"`,
    `          memory: "${limitMemGb}Gi"`,
  ];

  return lines.join('\n');
}

/**
 * Generate verification shell commands
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 */
export function generateVerificationScript(state, m) {
  const isRhel = state.targetDistro === 'rhel_rocky';
  const lines = [
    '#!/usr/bin/env bash',
    '# =============================================================================',
    `# JMeter OS Kernel Tuning Verification Script (${state.targetDistro})`,
    '# =============================================================================',
    'set -euo pipefail',
    '',
    'echo "=== 1. Checking Active File Descriptor Limits ==="',
    'echo "ulimit -n (Process Soft Limit): $(ulimit -n)"',
    'echo "fs.file-max (Kernel Total Limit): $(cat /proc/sys/fs/file-max)"',
    'echo "fs.file-nr (Allocated / Unused / Max): $(cat /proc/sys/fs/file-nr)"',
    '',
    'echo -e "\n=== 2. Checking Ephemeral Port Range & Socket State ==="',
    'echo "Local port range: $(cat /proc/sys/net/ipv4/ip_local_port_range)"',
    'echo "TCP TW Reuse: $(cat /proc/sys/net/ipv4/tcp_tw_reuse)"',
    'echo "TCP FIN Timeout: $(cat /proc/sys/net/ipv4/tcp_fin_timeout)"',
    'ss -s',
    '',
    'echo -e "\n=== 3. Checking Listen Queue & Backlog ==="',
    'echo "somaxconn: $(cat /proc/sys/net/core/somaxconn)"',
    'echo "tcp_max_syn_backlog: $(cat /proc/sys/net/ipv4/tcp_max_syn_backlog)"',
    '',
    'echo -e "\n=== 4. Checking Swappiness & Memory Maps ==="',
    'echo "vm.swappiness: $(cat /proc/sys/vm/swappiness)"',
    'echo "vm.max_map_count: $(cat /proc/sys/vm/max_map_count)"',
  ];

  if (isRhel) {
    lines.push(
      '',
      'echo -e "\\n=== 5. Checking RHEL limits.d order ==="',
      'ls -l /etc/security/limits.d/'
    );
  }

  lines.push(
    '',
    `echo "✅ Verification complete. Target nofile is ${m.nofile.toLocaleString()}."`
  );

  return lines.join('\n');
}

/**
 * Generate contextual architectural notes and warnings.
 * @param {OsTuningState} state
 * @param {ReturnType<typeof calculateKernelMetrics>} m
 * @returns {string[]}
 */
export function generateNotes(state, m) {
  const notes = [];

  notes.push(
    `File Descriptors: Configured for ${m.nofile.toLocaleString()} open files per process to handle ${state.concurrency.toLocaleString()} concurrent sockets + logging overhead.`
  );

  notes.push(
    `Ephemeral Ports: Expanded range to 1024-65535 (${m.availablePorts.toLocaleString()} ports) with tcp_tw_reuse=1 to eliminate java.net.BindException during rapid connection churn.`
  );

  notes.push(
    `JVM Garbage Collection Protection: Set vm.swappiness=${m.swappiness} to prevent Linux kernel from swapping JVM heap memory to disk during multi-hour test executions.`
  );

  notes.push(
    `Safety Notice: net.ipv4.tcp_tw_recycle is intentionally omitted because it was deprecated in Linux 4.10 and removed in 4.12 due to silent packet drops behind NAT gateways. Only tcp_tw_reuse is safe.`
  );

  if (state.targetDistro === 'docker_k8s') {
    notes.push(
      'Kubernetes Note: Only net.ipv4.ip_local_port_range is safe by default in Kubernetes. Other sysctls require kubelet --allowed-unsafe-sysctls whitelist flag.'
    );
  } else if (state.targetDistro === 'rhel_rocky') {
    notes.push(
      'RHEL/CentOS Note: /etc/security/limits.d/99-jmeter.conf overrides the default 20-nproc.conf limit of 4096 processes.'
    );
  }

  if (state.ramGb >= 32) {
    notes.push(
      `High-RAM Buffering: Sized TCP memory vector (tcp_mem) for ${state.ramGb} GB host RAM, preventing socket memory exhaustion (ENOBUFS).`
    );
  }

  return notes;
}

/**
 * Full computation plan returning all configuration snippets and metrics.
 * @param {Partial<OsTuningState>} input
 */
export function generateOsTuningPlan(input = {}) {
  const state = sanitizeOsTuningState(input);
  const metrics = calculateKernelMetrics(state);

  return {
    state,
    metrics,
    summary: {
      maxOpenFiles: metrics.nofile.toLocaleString(),
      availablePorts: metrics.availablePorts.toLocaleString(),
      listenQueue: metrics.somaxconn.toLocaleString(),
      swappiness: metrics.swappiness,
      bufferMaxMb: Math.round(metrics.rmemMax / (1024 * 1024)),
    },
    sysctl: generateSysctlSnippet(state, metrics),
    limits: generateLimitsSnippet(state, metrics),
    systemd: generateSystemdSnippet(state, metrics),
    dockerK8s: generateDockerK8sSnippet(state, metrics),
    verification: generateVerificationScript(state, metrics),
    notes: generateNotes(state, metrics),
  };
}

/**
 * Parse URL search parameters into state.
 * @param {URLSearchParams | Record<string, string>} params
 * @returns {OsTuningState}
 */
export function parseOsTuningParams(params) {
  const defaults = OS_TUNING.defaults;
  const limits = OS_TUNING.limits;

  const concurrency = readClampedNumber(params, 'concurrency', limits.concurrency, defaults.concurrency);
  const ramGb = readClampedNumber(params, 'ram', limits.ramGb, defaults.ramGb);

  const rawTraffic = typeof params.get === 'function' ? params.get('traffic') : /** @type {any} */ (params).traffic;
  const trafficType = OS_TUNING.trafficTypes.some((t) => t.id === rawTraffic)
    ? /** @type {OsTuningState['trafficType']} */ (rawTraffic)
    : defaults.trafficType;

  const rawDistro = typeof params.get === 'function' ? params.get('distro') : /** @type {any} */ (params).distro;
  const targetDistro = OS_TUNING.targetDistros.some((d) => d.id === rawDistro)
    ? /** @type {OsTuningState['targetDistro']} */ (rawDistro)
    : defaults.targetDistro;

  const rawRole = typeof params.get === 'function' ? params.get('role') : /** @type {any} */ (params).role;
  const role = OS_TUNING.roles.some((r) => r.id === rawRole)
    ? /** @type {OsTuningState['role']} */ (rawRole)
    : defaults.role;

  return { concurrency, ramGb, trafficType, targetDistro, role };
}

/**
 * Serialize state to URL search parameters.
 * @param {OsTuningState} state
 * @returns {string}
 */
export function serializeOsTuningParams(state) {
  const p = new URLSearchParams();
  p.set('concurrency', String(state.concurrency));
  p.set('ram', String(state.ramGb));
  p.set('traffic', state.trafficType);
  p.set('distro', state.targetDistro);
  p.set('role', state.role);
  return p.toString();
}
