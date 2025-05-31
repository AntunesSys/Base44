import React from "react";

export function CompactCard({ title, value, subtitle, icon: Icon, color = "emerald" }) {
  const colorClasses = {
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700",
    rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-700"
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4 hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-70">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className="h-8 w-8 opacity-70" />}
      </div>
    </div>
  );
}