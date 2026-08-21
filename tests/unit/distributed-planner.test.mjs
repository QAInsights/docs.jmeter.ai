import { describe, it, expect } from 'vitest';
import {
  parseIpList,
  sanitizeHost,
  generateDistributedPlan,
  parseDistributedPlannerParams,
  serializeDistributedPlannerParams,
} from '../../src/lib/distributed-planner.mjs';

describe('distributed-planner', () => {
  it('parses IP lists with mixed delimiters', () => {
    const list = parseIpList('10.0.1.10, 10.0.1.11 \n 10.0.1.12,10.0.1.13');
    expect(list).toEqual(['10.0.1.10', '10.0.1.11', '10.0.1.12', '10.0.1.13']);
  });

  it('sanitizes controller host input', () => {
    expect(sanitizeHost('10.0.0.5', 'default')).toBe('10.0.0.5');
    expect(sanitizeHost('bad;host&name', 'fallback')).toBe('fallback');
    expect(sanitizeHost('', 'fallback')).toBe('fallback');
  });

  it('generates consistent controller and worker configurations', () => {
    const plan = generateDistributedPlan({
      controllerIp: '10.0.0.5',
      workerIps: '10.0.1.10, 10.0.1.11',
      serverPort: 1099,
      serverRmiLocalPort: 50000,
      clientRmiLocalPort: 60000,
      disableSsl: false,
    });

    expect(plan.summary.totalNodes).toBe(3);
    expect(plan.summary.workerCount).toBe(2);
    expect(plan.summary.sslEnabled).toBe(true);

    expect(plan.controller.userProperties).toContain('remote_hosts=10.0.1.10:1099,10.0.1.11:1099');
    expect(plan.controller.userProperties).toContain('client.rmi.localport=60000');
    expect(plan.controller.userProperties).toContain('java.rmi.server.hostname=10.0.0.5');
    expect(plan.controller.userProperties).toContain('server.rmi.ssl.disable=false');

    expect(plan.worker.userProperties).toContain('server_port=1099');
    expect(plan.worker.userProperties).toContain('server.rmi.localport=50000');
    expect(plan.worker.instances.length).toBe(2);
    expect(plan.worker.instances[0].startupCommand).toContain('-Djava.rmi.server.hostname=10.0.1.10');

    expect(plan.firewallRules.length).toBe(3);
    expect(plan.firewallRules.some((r) => r.port === 1099)).toBe(true);
    expect(plan.firewallRules.some((r) => r.port === 50000)).toBe(true);
    expect(plan.firewallRules.some((r) => r.port === 60000)).toBe(true);

    expect(plan.dockerCompose).toContain('jmeter-master:');
    expect(plan.dockerCompose).toContain('jmeter-worker-1:');
    expect(plan.dockerCompose).toContain('jmeter-worker-2:');
  });

  it('parses and serializes URL query parameters round-trip', () => {
    const original = {
      controllerIp: '192.168.1.50',
      workerIps: '192.168.1.60, 192.168.1.61',
      serverPort: 2099,
      serverRmiLocalPort: 55000,
      clientRmiLocalPort: 65000,
      disableSsl: true,
      mode: /** @type {'Statistical'} */ ('Statistical'),
      environment: /** @type {'azure'} */ ('azure'),
    };

    const query = serializeDistributedPlannerParams(original);
    const parsed = parseDistributedPlannerParams(new URLSearchParams(query));

    expect(parsed.controllerIp).toBe(original.controllerIp);
    expect(parsed.serverPort).toBe(original.serverPort);
    expect(parsed.serverRmiLocalPort).toBe(original.serverRmiLocalPort);
    expect(parsed.clientRmiLocalPort).toBe(original.clientRmiLocalPort);
    expect(parsed.disableSsl).toBe(true);
    expect(parsed.mode).toBe('Statistical');
    expect(parsed.environment).toBe('azure');
  });

  it('generates environment-specific firewall and deployment snippets', () => {
    const baseParams = {
      controllerIp: '10.0.0.5',
      workerIps: '10.0.1.10',
      serverPort: 1099,
      serverRmiLocalPort: 50000,
      clientRmiLocalPort: 60000,
    };

    const awsPlan = generateDistributedPlan({ ...baseParams, environment: 'aws' });
    expect(awsPlan.envSnippet).toContain('aws ec2 authorize-security-group-ingress');

    const azurePlan = generateDistributedPlan({ ...baseParams, environment: 'azure' });
    expect(azurePlan.envSnippet).toContain('az network nsg rule create');

    const gcpPlan = generateDistributedPlan({ ...baseParams, environment: 'gcp' });
    expect(gcpPlan.envSnippet).toContain('gcloud compute firewall-rules create');

    const k8sPlan = generateDistributedPlan({ ...baseParams, environment: 'k8s' });
    expect(k8sPlan.envSnippet).toContain('kind: Service');
    expect(k8sPlan.envSnippet).toContain('clusterIP: None');

    const dockerPlan = generateDistributedPlan({ ...baseParams, environment: 'docker' });
    expect(dockerPlan.envSnippet).toContain('docker network create');

    const linuxPlan = generateDistributedPlan({ ...baseParams, environment: 'linux' });
    expect(linuxPlan.envSnippet).toContain('sudo ufw allow');
  });
});

