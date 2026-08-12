import { Tag, CheckCircle2, Ban, Coins } from "lucide-react";

interface KpiGridProps {
  stats: {
    total: number;
    active: number;
    disabled: number;
    totalBalance: number | string;
    currencyCode: string;
  };
  formatCurrency: (amount: number | string, currencyCode: string) => string;
}

export function KpiGrid({ stats, formatCurrency }: KpiGridProps) {
  const { total, active, disabled, totalBalance, currencyCode } = stats;
  const activePercentage = total > 0 ? ((active / total) * 100).toFixed(1) : "0";
  const disabledPercentage = total > 0 ? ((disabled / total) * 100).toFixed(1) : "0";

  return (
    <div className="kpi-grid">
      {/* Card 1: Total Gift Cards */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Total gift cards</span>
          <div className="kpi-icon-container icon-purple">
            <Tag size={20} />
          </div>
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{total.toLocaleString()}</span>
        </div>
      </div>

      {/* Card 2: Active Cards */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Active</span>
          <div className="kpi-icon-container icon-green">
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{active.toLocaleString()}</span>
          <span className="kpi-badge kpi-badge-green">{activePercentage}%</span>
        </div>
      </div>

      {/* Card 3: Disabled Cards */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Disabled</span>
          <div className="kpi-icon-container icon-orange">
            <Ban size={20} />
          </div>
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{disabled.toLocaleString()}</span>
          <span className="kpi-badge kpi-badge-orange">{disabledPercentage}%</span>
        </div>
      </div>

      {/* Card 4: Total Balance */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Total balance</span>
          <div className="kpi-icon-container icon-blue">
            <Coins size={20} />
          </div>
        </div>
        <div className="kpi-body">
          <span className="kpi-value">{formatCurrency(totalBalance, currencyCode)}</span>
        </div>
      </div>
    </div>
  );
}
