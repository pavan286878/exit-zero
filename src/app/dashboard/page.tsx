/**
 * ExitZero Dashboard - Real-time retention metrics
 * Shows save rates, MRR impact, and bandit performance
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

interface DashboardMetrics {
  totalCancellations: number;
  totalOffersSent: number;
  totalOffersAccepted: number;
  saveRate: number;
  avgProcessingTime: number;
  mrrSaved: number;
  banditPerformance: any[];
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

function MetricCard({ title, value, change, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {change !== undefined && (
            <div className="flex items-center mt-1">
              {change >= 0 ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ml-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(change)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Get customer ID from auth context (simplified for demo)
      const customerId = 'demo_customer'; // This would come from auth
      
      // Call the metrics API
      const response = await fetch(`/api/metrics?customerId=${customerId}&timeRange=${timeRange}`);
      const data = await response.json();
      
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/export?format=sql');
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exitzero-data-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ExitZero Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                AI-native retention infrastructure
              </p>
            </div>
            <div className="flex space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={exportData}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Save Rate"
            value={`${metrics?.saveRate || 0}%`}
            change={12} // This would come from comparison data
            icon={ChartBarIcon}
            color="green"
          />
          <MetricCard
            title="MRR Saved"
            value={`$${metrics?.mrrSaved || 0}`}
            change={8}
            icon={CurrencyDollarIcon}
            color="blue"
          />
          <MetricCard
            title="Offers Sent"
            value={metrics?.totalOffersSent || 0}
            change={-2}
            icon={UserGroupIcon}
            color="yellow"
          />
          <MetricCard
            title="Avg Response Time"
            value={`${metrics?.avgProcessingTime || 0}ms`}
            icon={ClockIcon}
            color="blue"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Save Rate Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Rate Trend</h3>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2" />
                <p>Chart would be rendered here</p>
                <p className="text-sm">Integration with Chart.js or Recharts</p>
              </div>
            </div>
          </div>

          {/* Bandit Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Offer Performance</h3>
            <div className="space-y-4">
              {metrics?.banditPerformance?.map((arm, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{arm.type}</p>
                    <p className="text-sm text-gray-500">{arm.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{arm.qValue.toFixed(3)}</p>
                    <p className="text-sm text-gray-500">{arm.count} uses</p>
                  </div>
                </div>
              )) || (
                <div className="text-center text-gray-500 py-8">
                  <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
                  <p>No offer data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {/* This would be populated with recent cancel intents, offers, etc. */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Offer sent to customer@example.com</p>
                  <p className="text-sm text-gray-500">20% discount for 3 months</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">2 minutes ago</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Accepted
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Cancel intent detected</p>
                  <p className="text-sm text-gray-500">Pro Plan - $99/month</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">5 minutes ago</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Processing
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
