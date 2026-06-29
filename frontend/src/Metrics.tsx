import React, { useState, useEffect } from 'react';

// Define TypeScript interfaces for the data
interface NodeMetric {
  name: string;
  os: string;
  kubeletVersion: string;
  capacity: { cpu: string; memory: string };
  usage: { cpu: string; memory: string };
}

// Helper functions to parse K8s resource strings
const parseCPU = (cpuStr: string): number => {
  if (!cpuStr) return 0;
  if (cpuStr.endsWith('n')) return parseInt(cpuStr.slice(0, -1)) / 1000000000;
  if (cpuStr.endsWith('m')) return parseInt(cpuStr.slice(0, -1)) / 1000;
  return parseInt(cpuStr);
};

const parseMemory = (memStr: string): number => {
  if (!memStr) return 0;
  if (memStr.endsWith('Ki')) return parseInt(memStr.slice(0, -2)) / (1024 * 1024);
  if (memStr.endsWith('Mi')) return parseInt(memStr.slice(0, -2)) / 1024;
  if (memStr.endsWith('Gi')) return parseInt(memStr.slice(0, -2));
  return parseInt(memStr);
};

const Metrics: React.FC = () => {
  const [nodes, setNodes] = useState<NodeMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Adjust URL if your FastAPI backend runs elsewhere
        const res = await fetch('http://localhost:8000/metrics/nodes');
        const data = await res.json();
        setNodes(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch metrics', err);
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading metrics...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Cluster Topology & Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {nodes.map((node) => {
          const usedCPU = parseCPU(node.usage.cpu);
          const totalCPU = parseInt(node.capacity.cpu);
          const cpuPercent = (usedCPU / totalCPU) * 100;

          const usedMem = parseMemory(node.usage.memory);
          const totalMem = parseMemory(node.capacity.memory);
          const memPercent = (usedMem / totalMem) * 100;

          return (
            <div key={node.name} className="bg-white p-4 rounded shadow-md">
              <h3 className="text-lg font-semibold text-gray-800">{node.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {node.kubeletVersion} | {node.os}
              </p>

              {/* CPU Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU Usage</span>
                  <span>{usedCPU.toFixed(2)} / {totalCPU} Cores</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${cpuPercent}%` }}></div>
                </div>
              </div>

              {/* Memory Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{usedMem.toFixed(2)} / {totalMem.toFixed(2)} GiB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${memPercent}%` }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Metrics;