import type { GetServerSideProps } from 'next';
import Head from 'next/head';

const PHASE_COLORS: Record<string, string> = {
  PH0: '#60A5FA', PH1: '#2EC4B6', PH2: '#34D399',
  PH3: '#F97316', PH4: '#A78BFA', PH5: '#EC4899',
};
const PHASE_LABELS: Record<string, string> = {
  PH0: 'Day 1', PH1: 'Week 1', PH2: 'Week 2',
  PH3: 'Month 1', PH4: 'Month 2', PH5: 'Month 3',
};
const PHASE_ORDER = ['PH0', 'PH1', 'PH2', 'PH3', 'PH4', 'PH5'];
const PHASE_BLURB: Record<string, string> = {
  PH0: 'Getting set up — meeting your buddy and coach, and finding your feet.',
  PH1: 'Access, tooling, and your first coffee connects.',
  PH2: 'Role deep-dive and the mandatory training out of the way.',
  PH3: 'Settling into the team — company context and Symphony access.',
  PH4: 'Real project work and a scorecard check-in.',
  PH5: 'Closing out the 90 days with feedback and reflection.',
};

const GATING: Record<string, boolean> = {
  DA1: true, DA2: true, DA3: true, W1: true, W3: true, X1: true, X2: true,
  M1: true, M4: true, S2: true, S4: true, T2: true,
};
const TASK_TOTAL = 24;

function motivator(pct: number, complete: boolean) {
  if (complete) return { title: 'Onboarding Complete', line: "You've made it through all 90 days — welcome to the team, for real this time." };
  if (pct >= 75) return { title: 'Almost There', line: "The finish line is in sight. A few required steps left and you're done." };
  if (pct >= 50) return { title: 'Halfway Champion', line: 'Past the halfway mark — momentum like this is how onboarding gets done early.' };
  if (pct >= 25) return { title: 'On a Roll', line: 'Solid progress. Keep the streak going.' };
  if (pct > 0) return { title: 'Building Momentum', line: "You're in motion — the first steps are always the ones that matter most." };
  return { title: 'Just Getting Started', line: "Everyone starts here. Let's get your first task ticked off." };
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.query;
  const proto = ctx.req.headers['x-forwarded-proto'] || 'https';
  const host = ctx.req.headers.host;
  let state: any = null;
  try {
    const r = await fetch(`${proto}://${host}/api/state?userId=${encodeURIComponent(String(id))}`, {
      headers: { cookie: ctx.req.headers.cookie || '' },
    });
    const d = await r.json();
    state = d.state || null;
  } catch { /* fall through to not-found */ }
  if (!state) return { notFound: true };
  return { props: { state } };
};

export default function Snapshot({ state }: { state: any }) {
  if (!state) {
    return (
      <>
        <Head><title>Progress Snapshot — NIIT Naya</title></Head>
        <style>{`body{font-family:Poppins,sans-serif;background:#FFFFFF;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#6B7280;}`}</style>
        <div>This progress snapshot isn't available.</div>
      </>
    );
  }

  const ts = state.task_states || {};
  const vals: string[] = Object.values(ts);
  const gatingIds = Object.keys(GATING);
  const gatingDone = gatingIds.filter(id => ts[id] === 'COMPLETE').length;
  const requiredPct = gatingIds.length ? Math.round((gatingDone / gatingIds.length) * 100) : 0;
  const complete = state.phase === 'PH5' && gatingDone === gatingIds.length;
  const mv = motivator(requiredPct, complete);
  const firstName = (state.user_name || '').split(' ')[0] || 'there';
  const currentPhaseIdx = PHASE_ORDER.indexOf(state.phase);

  return (
    <>
      <Head>
        <title>{firstName}'s Progress — NIIT Naya</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Poppins,sans-serif;background:#FFFFFF;color:#1F2937;}
        .wrap{max-width:640px;margin:0 auto;padding:40px 20px 60px;}
        .logo{width:56px;height:56px;border-radius:50%;background:white;border:3px solid #1E3A5F;display:flex;align-items:center;justify-content:center;font-weight:900;color:#1E3A5F;margin:0 auto 16px;}
        h1{text-align:center;font-size:22px;font-weight:800;color:#111827;}
        .sub{text-align:center;font-size:13px;color:#6B7280;margin-top:4px;margin-bottom:28px;}
        .mv{background:linear-gradient(135deg,#FFF5FA,#EEF4FB);border-radius:14px;padding:22px;text-align:center;margin-bottom:28px;}
        .mv-title{font-size:19px;font-weight:800;color:#111827;margin-bottom:6px;}
        .mv-line{font-size:13.5px;color:#4B5563;}
        .mv-pct{font-size:40px;font-weight:900;background:linear-gradient(135deg,#F97316,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:10px;}
        .roadmap{margin-bottom:28px;}
        .roadmap-h{font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;text-align:center;}
        .rm-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6;}
        .rm-row:last-child{border-bottom:none;}
        .rm-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .rm-label{font-size:13px;font-weight:700;flex:1;}
        .rm-blurb{font-size:11.5px;color:#9CA3AF;}
        .cta{display:block;text-align:center;background:linear-gradient(135deg,#F97316,#EC4899);color:white;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;margin-top:10px;}
      `}</style>
      <div className="wrap">
        <div className="logo">N</div>
        <h1>Hi {firstName} 👋</h1>
        <div className="sub">Your NIIT CAS onboarding progress</div>

        <div className="mv">
          <div className="mv-title">{mv.title}</div>
          <div className="mv-line">{mv.line}</div>
          <div className="mv-pct">{requiredPct}%</div>
        </div>

        <div className="roadmap">
          <div className="roadmap-h">90-Day Roadmap</div>
          {PHASE_ORDER.map((ph, i) => (
            <div className="rm-row" key={ph}>
              <span className="rm-dot" style={{ background: i <= currentPhaseIdx ? PHASE_COLORS[ph] : '#E5E7EB' }} />
              <span className="rm-label" style={{ color: i <= currentPhaseIdx ? '#111827' : '#9CA3AF' }}>{PHASE_LABELS[ph]}</span>
              <span className="rm-blurb">{PHASE_BLURB[ph]}</span>
            </div>
          ))}
        </div>

        <a className="cta" href="/">Continue in Naya →</a>
      </div>
    </>
  );
}
