import { Cloud, X } from "lucide-react";

export const WordCloud: React.FC<{
  setShowWordCloud: (open: boolean) => void;
  setSelectedWord: (word: string) => void;
  wordCloudData: { word: string; count: number }[];
}> = ({ setShowWordCloud, setSelectedWord, wordCloudData }) => {
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-950 rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Word Cloud Visualization
              </h2>
            </div>
            <button
              onClick={() => setShowWordCloud(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Word Cloud Content */}
          <div className="p-6">
            {wordCloudData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No word data available
              </div>
            ) : (
              <>
                {/* Beautiful Flowing Word Cloud */}
                <div className="mb-6 p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 rounded-xl shadow-inner">
                  <div className="flex flex-wrap gap-3 justify-center items-center min-h-[300px]">
                    {wordCloudData.map((item, index) => {
                      const maxCount = Math.max(
                        ...wordCloudData.map((w) => w.count)
                      );
                      const minCount = Math.min(
                        ...wordCloudData.map((w) => w.count)
                      );
                      const range = maxCount - minCount || 1;
                      const normalized = (item.count - minCount) / range;

                      // Dynamic sizing - larger range for more dramatic effect
                      const fontSize = Math.round(16 + normalized * 40); // 16px to 56px
                      const fontWeight = Math.round(400 + normalized * 500); // 400 to 900

                      // Beautiful color gradient - purple to blue to cyan
                      const hue = 240 - normalized * 60; // 240 (purple) to 180 (cyan)
                      const saturation = 70 + normalized * 30; // 70% to 100%
                      const lightness = 55 - normalized * 20; // 55% to 35%

                      // Random slight rotation for organic feel
                      const rotation = (Math.random() - 0.5) * 10; // -5 to 5 degrees

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setSelectedWord(item.word);
                            setShowWordCloud(false);
                          }}
                          className="transition-all duration-300 hover:scale-125 hover:-translate-y-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl px-4 py-2 backdrop-blur-sm"
                          style={{
                            fontSize: `${fontSize}px`,
                            fontWeight: fontWeight,
                            color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                            textShadow: `
                                0 2px 8px rgba(0,0,0,0.15),
                                0 4px 16px ${`hsl(${hue}, ${saturation}%, ${lightness}%, 0.3)`}
                              `,
                            transform: `rotate(${rotation}deg)`,
                            lineHeight: 1.2,
                          }}
                          title={`${item.word}: ${item.count} mentions - Click to filter`}
                        >
                          {item.word}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Legend */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-8 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="flex items-baseline gap-1">
                        <span
                          style={{
                            fontSize: "20px",
                            fontWeight: 600,
                            color: "hsl(180, 100%, 35%)",
                          }}
                        >
                          Smaller
                        </span>
                        <span className="text-gray-400">→</span>
                        <span
                          style={{
                            fontSize: "32px",
                            fontWeight: 900,
                            color: "hsl(240, 100%, 35%)",
                          }}
                        >
                          Larger
                        </span>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <div className="text-center">
                      <p className="font-medium">Word size & color intensity</p>
                      <p>= Frequency of mentions</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Enhanced Stats Dashboard */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800/50">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                    Unique Words
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {wordCloudData.length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                    Total Mentions
                  </p>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                    {wordCloudData
                      .reduce((sum, item) => sum + item.count, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 p-4 rounded-xl border border-purple-200 dark:border-purple-800/50">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                    Top Word
                  </p>
                  <p
                    className="text-xl font-bold text-purple-700 dark:text-purple-300 truncate"
                    title={wordCloudData[0]?.word}
                  >
                    {wordCloudData[0]?.word || "N/A"}
                  </p>
                  <p className="text-xs text-purple-500 dark:text-purple-400">
                    {wordCloudData[0]?.count} times
                  </p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Hover over words to see details • Click to filter comments
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
