import { describe, it, expect } from 'vitest';
import {
  sanitizeOsTuningState,
  calculateKernelMetrics,
  generateSysctlSnippet,
  generateLimitsSnippet,
  generateSystemdSnippet,
  generateDockerK8sSnippet,
  generateVerificationScript,
  generateNotes,
  generateOsTuningPlan,
  parseOsTuningParams,
  serializeOsTuningParams,
} from '../../src/lib/os-tuning.mjs';
import { OS_TUNING } from '../../src/lib/tools-config.mjs';

describe('os-tuning: state sanitization and defaults', () => {
  it('uses default values when given empty input', () => {
    const state = sanitizeOsTuningState({});
    expect(state.concurrency).toBe(OS_TUNING.defaults.concurrency);
    expect(state.ramGb).toBe(OS_TUNING.defaults.ramGb);
    expect(state.trafficType).toBe('http_churn');
    expect(state.targetDistro).toBe('ubuntu_debian');
    expect(state.role).toBe('injector');
  });

  it('clamps concurrency and ram to configured bounds', () => {
    const clampedMin = sanitizeOsTuningState({ concurrency: 1, ramGb: 1 });
    expect(clampedMin.concurrency).toBe(OS_TUNING.limits.concurrency.min);
    expect(clampedMin.ramGb).toBe(OS_TUNING.limits.ramGb.min);

    const clampedMax = sanitizeOsTuningState({ concurrency: 9_999_999, ramGb: 9999 });
    expect(clampedMax.concurrency).toBe(OS_TUNING.limits.concurrency.max);
    expect(clampedMax.ramGb).toBe(OS_TUNING.limits.ramGb.max);
  });

  it('handles 256 GB and 512 GB high-memory presets', () => {
    const state256 = sanitizeOsTuningState({ ramGb: 256 });
    expect(state256.ramGb).toBe(256);
    const m256 = calculateKernelMetrics(state256);
    expect(m256.rmemMax).toBe(67108864);

    const state512 = sanitizeOsTuningState({ ramGb: 512 });
    expect(state512.ramGb).toBe(512);
  });

  it('falls back to default if invalid trafficType, distro, or role is provided', () => {
    const fallback = sanitizeOsTuningState({
      // @ts-expect-error test invalid inputs
      trafficType: 'invalid_type',
      // @ts-expect-error test invalid inputs
      targetDistro: 'windows_95',
      // @ts-expect-error test invalid inputs
      role: 'unknown_role',
    });
    expect(fallback.trafficType).toBe(OS_TUNING.defaults.trafficType);
    expect(fallback.targetDistro).toBe(OS_TUNING.defaults.targetDistro);
    expect(fallback.role).toBe(OS_TUNING.defaults.role);
  });
});

describe('os-tuning: kernel metrics calculation', () => {
  it('scales file descriptors based on concurrency', () => {
    const small = calculateKernelMetrics({
      concurrency: 1000,
      ramGb: 8,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(small.nofile).toBe(65536);

    const medium = calculateKernelMetrics({
      concurrency: 20000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(medium.nofile).toBe(524288);

    const extreme = calculateKernelMetrics({
      concurrency: 100000,
      ramGb: 64,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(extreme.nofile).toBe(1048576);
  });

  it('sets ephemeral port range to 1024-65535 and enables tcp_tw_reuse', () => {
    const m = calculateKernelMetrics({
      concurrency: 10000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(m.portRange).toBe('1024 65535');
    expect(m.availablePorts).toBe(64512);
    expect(m.tcpTwReuse).toBe(1);
    expect(m.tcpFinTimeout).toBe(15);
  });

  it('sets shorter FIN timeout for http_churn vs keepalive', () => {
    const churn = calculateKernelMetrics({
      concurrency: 5000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    const keepalive = calculateKernelMetrics({
      concurrency: 5000,
      ramGb: 16,
      trafficType: 'http_keepalive',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(churn.tcpFinTimeout).toBe(15);
    expect(keepalive.tcpFinTimeout).toBe(30);
  });

  it('sizes TCP buffers according to system RAM', () => {
    const smallRam = calculateKernelMetrics({
      concurrency: 5000,
      ramGb: 4,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(smallRam.rmemMax).toBe(16777216);

    const midRam = calculateKernelMetrics({
      concurrency: 5000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(midRam.rmemMax).toBe(33554432);

    const highRam = calculateKernelMetrics({
      concurrency: 5000,
      ramGb: 64,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    expect(highRam.rmemMax).toBe(67108864);
  });

  it('sets vm.swappiness to 1 for load injectors and 10 for target servers', () => {
    const inj = calculateKernelMetrics({
      concurrency: 10000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'injector',
    });
    const sut = calculateKernelMetrics({
      concurrency: 10000,
      ramGb: 16,
      trafficType: 'http_churn',
      targetDistro: 'ubuntu_debian',
      role: 'target_sut',
    });
    expect(inj.swappiness).toBe(1);
    expect(sut.swappiness).toBe(10);
  });
});

describe('os-tuning: snippet generation and distro tailoring', () => {
  const sampleState = {
    concurrency: 25000,
    ramGb: 32,
    trafficType: /** @type {const} */ ('http_churn'),
    targetDistro: /** @type {const} */ ('ubuntu_debian'),
    role: /** @type {const} */ ('injector'),
  };
  const metrics = calculateKernelMetrics(sampleState);

  it('generates valid sysctl.conf snippet containing critical directives', () => {
    const sysctl = generateSysctlSnippet(sampleState, metrics);
    expect(sysctl).toContain('fs.file-max');
    expect(sysctl).toContain('net.ipv4.ip_local_port_range = 1024 65535');
    expect(sysctl).toContain('net.ipv4.tcp_tw_reuse = 1');
    expect(sysctl).toContain('net.core.somaxconn');
    expect(sysctl).toContain('vm.swappiness = 1');
    expect(sysctl).toContain('net.netfilter.nf_conntrack_max');
  });

  it('tailors limits.conf and systemd snippets by targetDistro', () => {
    const rhelState = { ...sampleState, targetDistro: /** @type {const} */ ('rhel_rocky') };
    const rhelLimits = generateLimitsSnippet(rhelState, metrics);
    expect(rhelLimits).toContain('20-nproc.conf');

    const rhelSystemd = generateSystemdSnippet(rhelState, metrics);
    expect(rhelSystemd).toContain('/etc/systemd/system.conf.d/99-jmeter-limits.conf');

    const debianSystemd = generateSystemdSnippet(sampleState, metrics);
    expect(debianSystemd).toContain('/etc/systemd/system.conf and /etc/systemd/user.conf');
  });

  it('accurately distinguishes safe vs unsafe sysctls in Kubernetes manifests', () => {
    const dockerK8s = generateDockerK8sSnippet(sampleState, metrics);
    expect(dockerK8s).toContain('--ulimit nofile=524288:524288');
    expect(dockerK8s).toContain('# Safe sysctl (default allowed):');
    expect(dockerK8s).toContain('- name: net.ipv4.ip_local_port_range');
    expect(dockerK8s).toContain('# Unsafe sysctls (require kubelet --allowed-unsafe-sysctls):');
    expect(dockerK8s).toContain('--allowed-unsafe-sysctls="net.core.somaxconn,net.ipv4.tcp_tw_reuse,net.ipv4.tcp_fin_timeout"');
    // Memory limit derived from state.ramGb (32 GB)
    expect(dockerK8s).toContain('memory: "32Gi"');
    expect(dockerK8s).toContain('memory: "24Gi"');
  });

  it('generates verification script with key diagnostic commands', () => {
    const verify = generateVerificationScript(sampleState, metrics);
    expect(verify).toContain('#!/usr/bin/env bash');
    expect(verify).toContain('ulimit -n');
    expect(verify).toContain('/proc/sys/net/ipv4/ip_local_port_range');
    expect(verify).toContain('ss -s');
  });

  it('generates contextual notes and warnings', () => {
    const notes = generateNotes(sampleState, metrics);
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes.some((n) => n.includes('tcp_tw_recycle'))).toBe(true);
    expect(notes.some((n) => n.includes('swappiness'))).toBe(true);
  });

  it('generates complete plan via generateOsTuningPlan', () => {
    const plan = generateOsTuningPlan(sampleState);
    expect(plan.summary.maxOpenFiles).toBe(metrics.nofile.toLocaleString());
    expect(plan.summary.availablePorts).toBe('64,512');
    expect(plan.sysctl).toBeTruthy();
    expect(plan.limits).toBeTruthy();
    expect(plan.systemd).toBeTruthy();
    expect(plan.dockerK8s).toBeTruthy();
    expect(plan.verification).toBeTruthy();
  });
});

describe('os-tuning: URL serialization and parsing', () => {
  it('serializes and parses state to and from URLSearchParams', () => {
    const initial = {
      concurrency: 50000,
      ramGb: 256,
      trafficType: /** @type {const} */ ('streaming_ws_grpc'),
      targetDistro: /** @type {const} */ ('rhel_rocky'),
      role: /** @type {const} */ ('target_sut'),
    };
    const qs = serializeOsTuningParams(initial);
    const parsed = parseOsTuningParams(new URLSearchParams(qs));

    expect(parsed.concurrency).toBe(50000);
    expect(parsed.ramGb).toBe(256);
    expect(parsed.trafficType).toBe('streaming_ws_grpc');
    expect(parsed.targetDistro).toBe('rhel_rocky');
    expect(parsed.role).toBe('target_sut');
  });
});
