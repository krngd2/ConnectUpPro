import { Modal } from "@/components/ui/modal";
import { AnalysisDataCluster } from "@/lib/analysis";
import { createPortal } from "react-dom";
import { ResponsiveContainer, Pie, Tooltip, Cell, PieChart } from "recharts";

export const TopicPieChartModel: React.FC<{
  isPieChartModalOpen: boolean;
  videoTitle: string;
  setIsPieChartModalOpen: (open: boolean) => void;
  clusters: AnalysisDataCluster[];
}> = ({
  isPieChartModalOpen,
  setIsPieChartModalOpen,
  clusters,
  videoTitle,
}) => {
  return createPortal(
    <Modal
      isOpen={isPieChartModalOpen}
      onClose={() => setIsPieChartModalOpen(false)}
      title="Topics Distribution"
      size="lg"
    >
      <div className="p-6">
        {/* Video title */}
        <h2 className="text-lg font-semibold mb-4">{videoTitle}</h2>
        {clusters.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={clusters
                  .sort((a, b) => b.commentIDs.length - a.commentIDs.length)
                  .map((cluster, index) => ({
                    name: cluster.name,
                    value: cluster.commentIDs.length,
                    fill: `hsl(${(index * 360) / clusters.length}, 70%, 50%)`,
                  }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => {
                  const { cx, cy, midAngle, outerRadius, percent, name, fill } =
                    entry;
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 20; // Position labels outside the circle
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={fill}
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={11}
                    >
                      {(() => {
                        const words = name.split(" ");
                        const lines = [];
                        for (let i = 0; i < words.length; i += 3) {
                          lines.push(words.slice(i, i + 3).join(" "));
                        }
                        return lines.map((line, idx) => (
                          <tspan key={idx} x={x} dy={idx === 0 ? 0 : "1.2em"}>
                            {line}
                          </tspan>
                        ));
                      })()}
                      <tspan x={x < cx ? x - 30 : x + 30} dy="1.2em">{`${(
                        percent * 100
                      ).toFixed(0)}%`}</tspan>
                    </text>
                  );
                }}
                outerRadius={120}
                dataKey="value"
              >
                {clusters.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(${(index * 360) / clusters.length}, 70%, 50%)`}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} comments`]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {/* <PieChart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>No topics available to visualize.</p>
            <p className="text-sm">
              Topics will appear once comment analysis is completed.
            </p> */}
          </div>
        )}
      </div>
    </Modal>,
    document.body
  );
};
