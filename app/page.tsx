"use client";

import { useState, useEffect } from "react";
import { Wand2, Edit3, Upload, Loader2, Combine, LogOut } from "lucide-react";
import {
  generateImageFromText,
  editImage,
  combineImages,
} from "./actions/image-generation";
import {
  compressImageClient,
  estimateBase64Size,
} from "@/lib/client-image-utils";
import { checkAuth, logout } from "./actions/auth";
import LoginForm from "./components/LoginForm";

type Feature = "text-to-image" | "edit-image" | "combine-images";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedFeature, setSelectedFeature] =
    useState<Feature>("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [generatedImage, setGeneratedImage] = useState<{
    data: string;
    mimeType?: string;
  } | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuth = await checkAuth();
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error("Auth check error:", error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-purple-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onSuccess={() => setIsAuthenticated(true)} />;
  }

  const features = [
    { id: "text-to-image", name: "텍스트→이미지", icon: Wand2 },
    { id: "edit-image", name: "이미지 편집", icon: Edit3 },
    { id: "combine-images", name: "이미지 활용 생성", icon: Combine },
  ];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      // 이미지 결합은 2개만, 나머지는 1개만 처리
      const maxFiles = selectedFeature === "combine-images" ? 2 : 1;
      const promises = Array.from(files)
        .slice(0, maxFiles)
        .map(async (file) => {
          // Compress image on client side before uploading
          const compressedBase64 = await compressImageClient(file, 1024, 0.8);

          // Check size and compress more if needed
          let finalBase64 = compressedBase64;
          let quality = 0.7;

          while (estimateBase64Size(finalBase64) > 800 && quality > 0.3) {
            finalBase64 = await compressImageClient(file, 800, quality);
            quality -= 0.1;
          }

          console.log(
            `Image compressed to ${estimateBase64Size(finalBase64).toFixed(
              2
            )} KB`
          );
          return finalBase64;
        });

      const results = await Promise.all(promises);
      setUploadedImages(results);
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("이미지 업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResult("");
    setGeneratedImage(null);

    try {
      let response: {
        success: boolean;
        data?: string;
        mimeType?: string;
        isDescription?: boolean;
        error?: string;
        message?: string;
      };

      switch (selectedFeature) {
        case "text-to-image":
          response = await generateImageFromText(prompt);
          break;
        case "edit-image":
          if (!uploadedImages[0]) {
            alert("이미지를 먼저 업로드해주세요");
            setLoading(false);
            return;
          }
          response = await editImage(uploadedImages[0], prompt);
          break;
        case "combine-images":
          if (uploadedImages.length < 2) {
            alert("2개의 이미지를 업로드해주세요");
            setLoading(false);
            return;
          }
          response = await combineImages(
            uploadedImages[0],
            uploadedImages[1],
            prompt
          );
          break;
      }

      if (response?.success) {
        if (response.mimeType && response.data) {
          // Actual image data received
          setGeneratedImage({
            data: response.data,
            mimeType: response.mimeType,
          });
          setResult("이미지 생성 완료");
        } else if (response.isDescription) {
          // Description received (for text-to-image and other generation features)
          setResult(response.data || "생성 완료");
        } else {
          setResult(response.data || "처리 완료");
        }
      } else {
        setResult("오류: " + (response?.error || "알 수 없는 오류"));
      }
    } catch (error) {
      console.error(error);
      setResult("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const needsImageUpload =
    selectedFeature === "edit-image" || selectedFeature === "combine-images";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-gray-900">
      {/* Navigation Bar */}
      <nav className="backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg sm:rounded-xl blur opacity-70"></div>
              <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg sm:rounded-xl p-1.5 sm:p-2">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Artify
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                AI Image Studio
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all text-gray-700 dark:text-gray-300"
          >
            <LogOut size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Feature Selection Cards */}
          <div className="mb-6">
            <h2 className="text-center text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
              작업 선택
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                const isSelected = selectedFeature === feature.id;
                return (
                  <button
                    key={feature.id}
                    onClick={() => {
                      setSelectedFeature(feature.id as Feature);
                      setUploadedImages([]);
                      setResult("");
                      setGeneratedImage(null);
                    }}
                    className={`group relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300 ${
                      isSelected
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg sm:shadow-xl"
                        : "bg-white dark:bg-gray-800 hover:shadow-lg border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="relative z-10">
                      <div
                        className={`inline-flex p-2 sm:p-2.5 rounded-lg sm:rounded-xl mb-2 ${
                          isSelected
                            ? "bg-white/20 backdrop-blur-sm"
                            : "bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={`sm:w-5 sm:h-5 ${
                            isSelected
                              ? "text-white"
                              : "text-purple-600 dark:text-purple-400"
                          }`}
                        />
                      </div>
                      <h3
                        className={`font-bold text-sm sm:text-base mb-0.5 ${
                          isSelected
                            ? "text-white"
                            : "text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {feature.name}
                      </h3>
                      <p
                        className={`text-xs hidden sm:block ${
                          isSelected
                            ? "text-white/80"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {feature.id === "text-to-image" &&
                          "텍스트로 생성"}
                        {feature.id === "edit-image" && "이미지 편집"}
                        {feature.id === "combine-images" &&
                          "두 이미지 활용"}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-0.5 sm:p-1">
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 lg:p-8">
            <div className="space-y-6">
              {needsImageUpload && (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    이미지 업로드{" "}
                    {selectedFeature === "combine-images" ? "(2개 필요)" : ""}
                  </label>
                  <label className="flex items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-all hover:border-purple-400 dark:hover:border-purple-500">
                    <div className="flex flex-col items-center">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                      <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        클릭하여 이미지 선택
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                        (자동으로 압축됩니다)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple={selectedFeature === "combine-images"}
                      onChange={handleImageUpload}
                    />
                  </label>
                  {uploadedImages.length > 0 && (
                    <div className="mt-3">
                      <div className="flex gap-2 flex-wrap mb-2">
                        {uploadedImages.map((img, index) => (
                          <div
                            key={index}
                            className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"
                          >
                            <span>이미지 {index + 1}</span>
                            <span className="text-xs text-gray-500">
                              ({estimateBase64Size(img).toFixed(0)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* 업로드된 이미지 미리보기 */}
                      <div
                        className={`grid ${
                          uploadedImages.length === 1
                            ? "grid-cols-1"
                            : uploadedImages.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                        } gap-2`}
                      >
                        {uploadedImages.map((img, index) => (
                          <div key={index} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/jpeg;base64,${img}`}
                              alt={`Uploaded ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                            />
                            <button
                              onClick={() => {
                                const newImages = uploadedImages.filter(
                                  (_, i) => i !== index
                                );
                                setUploadedImages(newImages);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="이미지 제거"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                  프롬프트 입력
                </label>
                {selectedFeature === "edit-image" && (
                  <div className="mb-2 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      💡 편집 팁: 구체적으로 설명할수록 좋은 결과를 얻을 수
                      있습니다.
                      <br className="hidden sm:block" />
                      <span className="hidden sm:inline">예시: &quot;배경을 일몰로 변경&quot;, &quot;빨간 옷을
                      파란색으로&quot;, &quot;사람 제거&quot;, &quot;밝게
                      만들기&quot;</span>
                    </p>
                  </div>
                )}
                {selectedFeature === "combine-images" && (
                  <div className="mb-2 p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      💡 활용 팁: 두 이미지를 참고하여 새로운 이미지를
                      생성합니다.
                      <br className="hidden sm:block" />
                      <span className="hidden sm:inline">예시: &quot;두 스타일을 섞은 새 이미지&quot;, &quot;첫
                      번째 캐릭터를 두 번째 배경에&quot;</span>
                    </p>
                  </div>
                )}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    selectedFeature === "text-to-image"
                      ? "생성하고 싶은 이미지를 설명하세요..."
                      : selectedFeature === "edit-image"
                      ? "어떻게 편집할지 구체적으로 설명하세요... (예: 배경을 해변으로 변경)"
                      : "두 이미지를 활용해서 어떤 이미지를 생성할지 설명하세요... (예: 두 스타일을 믹스한 판타지 장면)"
                  }
                  className="w-full px-3 sm:px-5 py-3 sm:py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl resize-none h-24 sm:h-32 bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:bg-white dark:focus:bg-gray-900 transition-all focus:shadow-lg text-sm sm:text-base"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    생성 중...
                  </span>
                ) : (
                  "생성하기"
                )}
              </button>

              {generatedImage && (
                <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    {selectedFeature !== "text-to-image"
                      ? "결과 비교:"
                      : "생성된 이미지:"}
                  </h3>

                  {/* 이미지 편집은 비포/애프터 비교 */}
                  {selectedFeature === "edit-image" && uploadedImages[0] ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">
                          원본 이미지
                        </p>
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/jpeg;base64,${uploadedImages[0]}`}
                            alt="Original"
                            className="w-full rounded-lg shadow-lg"
                          />
                          <span className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                            Before
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">
                          편집된 이미지
                        </p>
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${
                              generatedImage.mimeType || "image/png"
                            };base64,${generatedImage.data}`}
                            alt="Generated"
                            className="w-full rounded-lg shadow-lg"
                          />
                          <span className="absolute top-2 left-2 bg-green-500/70 text-white px-2 py-1 rounded text-xs">
                            After
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : selectedFeature === "combine-images" &&
                    uploadedImages.length >= 2 ? (
                    // 이미지 활용 생성은 2개 참고 이미지와 결과 표시
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">
                            참고 이미지 1
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/jpeg;base64,${uploadedImages[0]}`}
                            alt="First"
                            className="w-full rounded-lg shadow"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">
                            참고 이미지 2
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/jpeg;base64,${uploadedImages[1]}`}
                            alt="Second"
                            className="w-full rounded-lg shadow"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">
                          ↓ 생성된 결과
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:${
                            generatedImage.mimeType || "image/png"
                          };base64,${generatedImage.data}`}
                          alt="Combined"
                          className="w-full rounded-lg shadow-lg"
                        />
                      </div>
                    </div>
                  ) : (
                    // 텍스트→이미지는 결과만 표시
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:${
                          generatedImage.mimeType || "image/png"
                        };base64,${generatedImage.data}`}
                        alt="Generated"
                        className="w-full rounded-lg shadow-lg"
                      />
                    </>
                  )}
                </div>
              )}

              {result && !generatedImage && (
                <div className="mt-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    {selectedFeature === "text-to-image"
                      ? "생성된 이미지 설명:"
                      : "결과:"}
                  </h3>
                  <div className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {result}
                  </div>
                  {selectedFeature === "text-to-image" && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        💡 현재 Gemini API는 이미지 설명을 생성합니다. 실제
                        이미지 생성을 위해서는 Stable Diffusion, DALL-E 등의
                        별도 이미지 생성 API 연동이 필요합니다.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="text-center mt-10 text-gray-500 dark:text-gray-400 text-sm">
          <p>Powered by Gemini 2.5 Flash Image</p>
          <p className="mt-1">
            ⚠️ 생성된 모든 이미지에는 SynthID 워터마크가 포함됩니다
          </p>
        </footer>
      </div>
    </div>
  );
}
