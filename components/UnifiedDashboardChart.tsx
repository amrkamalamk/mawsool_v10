import React from 'react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { UnifiedDataPoint } from '../types';

interface Props {
  data: UnifiedDataPoint[];
}

const CustomDot = (props: any) => {
  const { cx, cy, value } = props;
  if (value === null || value === undefined) return null;
  const color = value < 80 ? '#ef4444' : value < 90 ? '#f59e0b' : '#10b981';
  return (
    <circle cx={cx} cy={cy} r={3} fill={color} stroke="#fff" strokeWidth={1} />
  );
};

const UnifiedDashboardChart: React.FC<Props> = ({ data }) => {
  const isDark = document.documentElement.classList.contains('dark');
  const tooltipTextColor = '#000000';
  const tooltipBgColor = '#ffffff';

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
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
            height={70}
          />
          <YAxis 
            yAxisId="left"
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}%`}
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
            formatter={(value: number, name: string) => [value ? (Number.isInteger(value) ? value.toString() : value.toFixed(2)) + (name === 'SL%' ? '%' : '') : '0', name]}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ 
              fontSize: '8px', 
              fontWeight: '900', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              paddingBottom: '20px'
            }}
          />
          
          <Bar yAxisId="left" dataKey="answered" name="Answered" stackId="traffic" fill="#10b981" barSize={15} />
          <Bar yAxisId="left" dataKey="abandoned" name="Abandoned" stackId="traffic" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={15} />
          
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="slPercent" 
            name="SL%" 
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            strokeWidth={1}
            dot={<CustomDot />}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default UnifiedDashboardChart;