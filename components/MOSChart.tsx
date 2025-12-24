import React from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';
import { UnifiedDataPoint } from '../types';

interface Props {
  data: UnifiedDataPoint[];
  threshold: number;
}

const MOSChart: React.FC<Props> = ({ data, threshold }) => {
  const isDark = document.documentElement.classList.contains('dark');
  const tooltipTextColor = '#000000';
  const tooltipBgColor = '#ffffff';

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
          <XAxis 
            dataKey="timestamp" 
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval={2}
            angle={270}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 5]} 
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toFixed(1)}
          />
          <Tooltip 
            cursor={{fill: isDark ? '#1e293b' : '#f8fafc'}}
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
              backgroundColor: tooltipBgColor,
              color: tooltipTextColor
            }}
            labelStyle={{ color: tooltipTextColor }}
            itemStyle={{ color: tooltipTextColor }}
            formatter={(value: number) => [value ? (Number.isInteger(value) ? value : value.toFixed(2)) : '0', 'MOS']}
          />
          <ReferenceLine 
            y={threshold} 
            stroke="#ef4444" 
            strokeDasharray="3 3" 
            strokeWidth={1}
            label={{ position: 'right', value: `${threshold}`, fill: '#ef4444', fontSize: 8, fontWeight: 'bold' }} 
          />
          <Bar dataKey="mos" radius={[4, 4, 0, 0]} barSize={10}>
            {data.map((entry, index) => {
              const val = entry.mos;
              const color = val === null ? (isDark ? '#818cf8' : '#6366f1') :
                            val < 4.3 ? '#ef4444' :
                            val < 4.8 ? '#f59e0b' :
                            '#10b981';
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={color} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MOSChart;