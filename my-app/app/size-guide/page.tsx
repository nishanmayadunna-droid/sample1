import type { Metadata } from "next";
import L from "../components/L";
import StorePage, { Bullets, Section } from "../components/StorePage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Size guide",
  description: "General body measurements in centimetres.",
};

const tops = [
  ["XS", "82–88", "64"],
  ["S", "88–94", "66"],
  ["M", "94–100", "68"],
  ["L", "100–106", "70"],
  ["XL", "106–112", "72"],
  ["XXL", "112–118", "74"],
];

const bottoms = [
  ["XS", "64–70", "86–90", "76"],
  ["S", "70–76", "90–95", "77"],
  ["M", "76–82", "95–100", "78"],
  ["L", "82–88", "100–105", "79"],
  ["XL", "88–94", "105–110", "80"],
  ["XXL", "94–100", "110–115", "81"],
];

const th = "border-b border-line px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted";
const td = "border-b border-line px-3 py-2";

export default function SizeGuidePage() {
  return (
    <StorePage
      eyebrow={<L si="මාර්ගෝපදේශය" en="Guide" />}
      title={<L si="ප්‍රමාණ මාර්ගෝපදේශය" en="Size guide" />}
    >
      <p>
        <L
          si="මේවා සෙන්ටිමීටර වලින් දක්වන සාමාන්‍ය ශරීර මිනුම් වේ. භාණ්ඩයෙන් භාණ්ඩයට ගැළපීම වෙනස් විය හැක."
          en="These are general body measurements in centimetres. Fit can vary from product to product."
        />
      </p>

      <Section title={<L si="උඩුකය (සෙ.මී.)" en="Tops (cm)" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse">
            <thead>
              <tr>
                <th className={th}><L si="ප්‍රමාණය" en="Size" /></th>
                <th className={th}><L si="පපුව" en="Chest" /></th>
                <th className={th}><L si="දිග" en="Length" /></th>
              </tr>
            </thead>
            <tbody>
              {tops.map(([s, chest, length]) => (
                <tr key={s}>
                  <td className={`${td} font-medium`}>{s}</td>
                  <td className={td}>{chest}</td>
                  <td className={td}>{length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={<L si="යටිකය (සෙ.මී.)" en="Bottoms (cm)" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse">
            <thead>
              <tr>
                <th className={th}><L si="ප්‍රමාණය" en="Size" /></th>
                <th className={th}><L si="ඉණ" en="Waist" /></th>
                <th className={th}><L si="උකුල" en="Hip" /></th>
                <th className={th}><L si="කකුලේ ඇතුළු දිග" en="Inseam" /></th>
              </tr>
            </thead>
            <tbody>
              {bottoms.map(([s, waist, hip, inseam]) => (
                <tr key={s}>
                  <td className={`${td} font-medium`}>{s}</td>
                  <td className={td}>{waist}</td>
                  <td className={td}>{hip}</td>
                  <td className={td}>{inseam}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={<L si="මනින ආකාරය" en="How to measure" />}>
        <Bullets>
          <li>
            <L
              si="මෘදු මිනුම් පටියක් භාවිතා කර, සැහැල්ලු ඇඳුමක් පැළඳ මනින්න."
              en="Use a soft tape measure over light clothing."
            />
          </li>
          <li>
            <L
              si="පපුව: පපුවේ පුළුල්ම කොටස වටා."
              en="Chest: around the fullest part of your chest."
            />
          </li>
          <li>
            <L
              si="ඉණ: ස්වභාවික ඉණ වටා, පටිය තද නොවන සේ."
              en="Waist: around your natural waist, tape snug but not tight."
            />
          </li>
          <li>
            <L
              si="උකුල: උකුලේ පුළුල්ම කොටස වටා."
              en="Hip: around the widest part of your hips."
            />
          </li>
          <li>
            <L
              si="කකුලේ ඇතුළු දිග: කලවය මුල සිට වළලුකර දක්වා."
              en="Inseam: from the top of the inner thigh down to the ankle."
            />
          </li>
        </Bullets>
        <p className="text-muted">
          <L
            si="මිනුම් දෙකක් අතර නම්, විශාල ප්‍රමාණය තෝරන්න."
            en="Between two sizes? Choose the larger one."
          />
        </p>
      </Section>
    </StorePage>
  );
}
