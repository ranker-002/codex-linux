import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Activity,
  GitBranch,
  FileCode,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Code,
  Clock,
} from 'lucide-react';

interface CodebaseMetrics {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  complexity: {
    low: number;
    medium: number;
    high: number;
  };
  issues: {
    errors: number;
    warnings: number;
    info: number;
  };
  testCoverage: number;
  recentActivity: Array<{
    date: string;
    commits: number;
    additions: number;
    deletions: number;
  }>;
}

interface CodebaseDashboardProps {
  projectPath: string;
}

export const CodebaseDashboard: React.FC<CodebaseDashboardProps> = ({
  projectPath,
}) => {
  const [metrics, setMetrics] = useState<CodebaseMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [projectPath]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // In real implementation, this would call the main process
      const mockMetrics: CodebaseMetrics = {
        totalFiles: 156,
        totalLines: 45230,
        languages: {
          TypeScript: 65,
          JavaScript: 15,
          CSS: 10,
          JSON: 5,
          Other: 5,
        },
        complexity: {
          low: 120,
          medium: 30,
          high: 6,
        },
        issues: {
          errors: 3,
          warnings: 12,
          info: 28,
        },
        testCoverage: 78,
        recentActivity: [
          { date: 'Mon', commits: 5, additions: 120, deletions: 45 },
          { date: 'Tue', commits: 8, additions: 340, deletions: 120 },
          { date: 'Wed', commits: 3, additions: 89, deletions: 67 },
          { date: 'Thu', commits: 12, additions: 567, deletions: 234 },
          { date: 'Fri', commits: 6, additions: 230, deletions: 89 },
          { date: 'Sat', commits: 2, additions: 45, deletions: 12 },
          { date: 'Sun', commits: 1, additions: 23, deletions: 5 },
        ],
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
    setIsLoading(false);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!metrics) return null;

  const languageData = Object.entries(metrics.languages).map(([name, value]) => ({
    name,
    value,
  }));

  const complexityData = [
    { name: 'Low', value: metrics.complexity.low, color: '#10B981' },
    { name: 'Medium', value: metrics.complexity.medium, color: '#F59E0B' },
    { name: 'High', value: metrics.complexity.high, color: '#EF4444' },
  ];

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Codebase Analytics</h1>
        <button
          onClick={loadMetrics}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<FileCode className="w-6 h-6" />}
          title="Total Files"
          value={metrics.totalFiles}
          subtitle={`${metrics.totalLines.toLocaleString()} lines`}
        />
        <MetricCard
          icon={<CheckCircle className="w-6 h-6" />}
          title="Test Coverage"
          value={`${metrics.testCoverage}%`}
          subtitle="Good coverage"
          color="text-green-500"
        />
        <MetricCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Issues"
          value={metrics.issues.errors + metrics.issues.warnings}
          subtitle={`${metrics.issues.errors} errors, ${metrics.issues.warnings} warnings`}
          color="text-yellow-500"
        />
        <MetricCard
          icon={<GitBranch className="w-6 h-6" />}
          title="Recent Commits"
          value={metrics.recentActivity.reduce((sum, d) => sum + d.commits, 0)}
          subtitle="Last 7 days"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-lg font-semibold mb-4">Language Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={languageData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {languageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-lg font-semibold mb-4">Code Complexity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={complexityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8">
                {complexityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics.recentActivity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="additions"
              stroke="#10B981"
              strokeWidth={2}
              name="Additions"
            />
            <Line
              type="monotone"
              dataKey="deletions"
              stroke="#EF4444"
              strokeWidth={2}
              name="Deletions"
            />
            <Line
              type="monotone"
              dataKey="commits"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Commits"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">AI Insights</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Codebase is well-structured with good separation of concerns
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Consider adding more tests to improve coverage to 85%+
              </li>
              <li className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-500" />
                6 files have high complexity - consider refactoring
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  color?: string;
}> = ({ icon, title, value, subtitle, color }) => (
  <div className="bg-card rounded-lg p-6 border border-border">
    <div className="flex items-center gap-4">
      <div className={`p-3 bg-muted rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  </div>
);