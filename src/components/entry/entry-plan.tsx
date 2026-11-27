/** Lámina de la entrada (RF-52): planta del local; la puerta de entrada se dibuja al cargar. */
export function EntryPlan({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-14 -6 630 580" role="img" aria-label="Planta de un estudio con la puerta de entrada resaltada">
    <g stroke="var(--plan-furniture)" fill="none">
    <rect x="76" y="86" width="90" height="54" />
    
    <rect x="186" y="86" width="90" height="54" />
    
    <rect x="76" y="190" width="90" height="54" />
    
    <rect x="186" y="190" width="56" height="54" />
    
    <path d="M330 90 h190 v40 h-150 v80 h-40z" />
    
    <circle cx="420" cy="250" r="26" />
    
    <rect x="80" y="400" width="140" height="70" />
    
    <rect x="380" y="380" width="140" height="30" />
    
    <rect x="380" y="430" width="140" height="30" />
    
    </g>
    <rect x="40" y="40" width="70" height="12" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="210" y="40" width="170" height="12" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="480" y="40" width="80" height="12" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="40" y="508" width="210" height="12" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="310" y="508" width="250" height="12" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="40" y="40" width="12" height="160" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="40" y="290" width="12" height="230" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="548" y="40" width="12" height="480" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="297" y="52" width="6" height="198" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="297" y="300" width="6" height="27" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="52" y="327" width="78" height="6" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="180" y="327" width="220" height="6" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <rect x="450" y="327" width="98" height="6" fill="var(--plan-wall)" stroke="var(--plan-wall-line)" strokeWidth="1" />
    
    <line x1="110" x2="210" y1="40" y2="40" stroke="var(--plan-wall-line)" />
    
    <line x1="380" x2="480" y1="40" y2="40" stroke="var(--plan-wall-line)" />
    
    <line x1="110" x2="210" y1="46" y2="46" stroke="var(--plan-wall-line)" />
    
    <line x1="380" x2="480" y1="46" y2="46" stroke="var(--plan-wall-line)" />
    
    <line x1="110" x2="210" y1="52" y2="52" stroke="var(--plan-wall-line)" />
    
    <line x1="380" x2="480" y1="52" y2="52" stroke="var(--plan-wall-line)" />
    
    <line x1="40" x2="40" y1="200" y2="290" stroke="var(--plan-wall-line)" />
    
    <line x1="46" x2="46" y1="200" y2="290" stroke="var(--plan-wall-line)" />
    
    <line x1="52" x2="52" y1="200" y2="290" stroke="var(--plan-wall-line)" />
    
    <line x1="303" y1="250" x2="353" y2="250" stroke="var(--plan-soft)" />
    
    <path d="M353,250 A50,50 0 0 1 303,300" fill="none" stroke="var(--plan-soft)" strokeDasharray="3 3" />
    
    <line x1="130" y1="333" x2="130" y2="383" stroke="var(--plan-soft)" />
    
    <path d="M130,383 A50,50 0 0 0 180,333" fill="none" stroke="var(--plan-soft)" strokeDasharray="3 3" />
    
    <line x1="450" y1="333" x2="450" y2="383" stroke="var(--plan-soft)" />
    
    <path d="M450,383 A50,50 0 0 1 400,333" fill="none" stroke="var(--plan-soft)" strokeDasharray="3 3" />
    
    <line className="plan-draw" pathLength="1" x1="250" y1="508" x2="250" y2="448" stroke="var(--fg)" strokeWidth="1.6" />
    
    <path className="plan-draw" pathLength="1" d="M250,448 A60,60 0 0 1 310,508" fill="none" stroke="var(--fg)" strokeWidth="1.6" />
    
    <text x="174" y="300" textAnchor="middle" fontSize="11" fill="var(--plan-soft)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">TALLER</text>
    <text x="174" y="316" textAnchor="middle" fontSize="10" fill="var(--plan-dim)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">23.6 m²</text>
    <text x="425" y="300" textAnchor="middle" fontSize="11" fill="var(--plan-soft)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">ATENCIÓN</text>
    <text x="425" y="316" textAnchor="middle" fontSize="10" fill="var(--plan-dim)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">23.6 m²</text>
    <text x="300" y="425" textAnchor="middle" fontSize="11" fill="var(--plan-soft)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">ENTREGAS</text>
    <text x="300" y="441" textAnchor="middle" fontSize="10" fill="var(--plan-dim)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">34.5 m²</text>
    <text x="280" y="500" textAnchor="middle" fontSize="10" fill="var(--fg)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">ENTRADA</text>
    <line x1="32" y1="14" x2="568" y2="14" stroke="var(--plan-dim)" />
    
    <line x1="35" y1="19" x2="45" y2="9" stroke="var(--plan-soft)" />
    
    <line x1="40" y1="5" x2="40" y2="23" stroke="var(--plan-tick)" />
    
    <line x1="555" y1="19" x2="565" y2="9" stroke="var(--plan-soft)" />
    
    <line x1="560" y1="5" x2="560" y2="23" stroke="var(--plan-tick)" />
    
    <text x="300.0" y="8" textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">10.40</text>
    <line x1="32" y1="552" x2="258" y2="552" stroke="var(--plan-dim)" />
    
    <line x1="35" y1="557" x2="45" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="40" y1="543" x2="40" y2="561" stroke="var(--plan-tick)" />
    
    <line x1="245" y1="557" x2="255" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="250" y1="543" x2="250" y2="561" stroke="var(--plan-tick)" />
    
    <text x="145.0" y="546" textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">4.20</text>
    <line x1="242" y1="552" x2="318" y2="552" stroke="var(--plan-dim)" />
    
    <line x1="245" y1="557" x2="255" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="250" y1="543" x2="250" y2="561" stroke="var(--plan-tick)" />
    
    <line x1="305" y1="557" x2="315" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="310" y1="543" x2="310" y2="561" stroke="var(--plan-tick)" />
    
    <text x="280.0" y="546" textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">1.20</text>
    <line x1="302" y1="552" x2="568" y2="552" stroke="var(--plan-dim)" />
    
    <line x1="305" y1="557" x2="315" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="310" y1="543" x2="310" y2="561" stroke="var(--plan-tick)" />
    
    <line x1="555" y1="557" x2="565" y2="547" stroke="var(--plan-soft)" />
    
    <line x1="560" y1="543" x2="560" y2="561" stroke="var(--plan-tick)" />
    
    <text x="435.0" y="546" textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">5.00</text>
    <line x1="12" y1="32" x2="12" y2="528" stroke="var(--plan-dim)" />
    
    <line x1="7" y1="45" x2="17" y2="35" stroke="var(--plan-soft)" />
    
    <line x1="3" y1="40" x2="21" y2="40" stroke="var(--plan-tick)" />
    
    <line x1="7" y1="525" x2="17" y2="515" stroke="var(--plan-soft)" />
    
    <line x1="3" y1="520" x2="21" y2="520" stroke="var(--plan-tick)" />
    
    <text x="5" y="280.0" textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="var(--font-geist-mono)" transform="rotate(-90 5 280.0)">9.60</text>
    <g transform="translate(590 70)">
    <circle r="14" fill="none" stroke="var(--plan-dim)" />
    
    <path d="M0,-11 L5,6 L0,2 L-5,6Z" fill="var(--muted)" />
    
    <text x="0" y="30" textAnchor="middle" fontSize="10" fill="var(--plan-soft)" fontFamily="var(--font-geist-mono)" letterSpacing="0.08em">N</text>
    </g>
    </svg>
  );
}
