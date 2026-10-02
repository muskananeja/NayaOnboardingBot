// The same top nav bar used across the employee/contractor experience
// (public/index.html's #topnav), reused here so admin screens read as the
// same product rather than a separate back-office tool.
export default function NayaHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="naya-topnav">
      <div className="naya-nav-brand">
        <div className="naya-nav-icon">N</div>
        <div>
          <div className="naya-nav-title">{title}</div>
          <div className="naya-nav-sub">{subtitle}</div>
        </div>
      </div>
      {badge && (
        <div className="naya-nav-right">
          <span className="naya-nav-badge">{badge}</span>
        </div>
      )}
    </div>
  );
}
