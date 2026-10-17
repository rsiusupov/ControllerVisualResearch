import { BloomCopy } from "@/src/components/bloom-copy";
import { Frames } from "@/src/components/frames";
import type { StudyRecord } from "@/src/lib/study";
import { Panel } from "@/src/ui/panel";

export function ControllerCard({ record }: { record: StudyRecord }) {
  return (
    <Panel className="study-card">
      <Frames images={record.images} name={record.name} />
      <div className="study-copy">
        <div className="cap">
          <span className="year">{record.year || "без даты"}</span>
          <strong>{record.name}</strong>
        </div>
        {record.manufacturer ? <p className="quiet">{record.manufacturer}</p> : null}
        {record.subcategoryLabel ? <p>{record.subcategoryLabel}</p> : null}
        {record.platform ? <p className="quiet">{record.platform}</p> : null}
        <BloomCopy parts={[record.description]} />
        {record.significance ? (
          <>
            <p className="block-title">Значение</p>
            <BloomCopy parts={[record.significance]} />
          </>
        ) : null}
      </div>
    </Panel>
  );
}
