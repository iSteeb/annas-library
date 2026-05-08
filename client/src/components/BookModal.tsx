import { useEffect, useState, useRef } from 'react';
import { X, Download, FileText, Calendar, Globe, HardDrive, Loader2, ChevronLeft, ChevronRight, DownloadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Book } from '../types';

interface BookModalProps {
  book: Book;
  onClose: () => void;
  onBookSelect?: (book: Book) => void;
}

export default function BookModal({ book, onClose, onBookSelect }: BookModalProps) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [description, setDescription] = useState(book.description || '');
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);
  const [currentBook, setCurrentBook] = useState<Book>(book);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [recScrollProgress, setRecScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canRecScrollLeft, setCanRecScrollLeft] = useState(false);
  const [canRecScrollRight, setCanRecScrollRight] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const similarScrollRef = useRef<HTMLDivElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);

  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);

  const dragStartY = useRef(0);
  const currentY = useRef(0);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    // Slide down fully off screen
    setTranslateY(typeof window !== 'undefined' ? window.innerHeight : 1000);
    setTimeout(() => {
      onClose();
    }, 300); // 300ms matches Tailwind duration-300
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const scrollArea = document.getElementById('modal-scroll-area');
    if (scrollArea && scrollArea.contains(e.target as Node)) {
      // If we're inside the text content and it's scrolled down, allow native scroll
      if (scrollArea.scrollTop > 0) return;
    }
    dragStartY.current = e.touches[0].clientY;
    currentY.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    
    // If scrolling up when at the top of the scroll area, let it do native scroll / bounce
    if (deltaY < 0) {
      setTranslateY(0);
      currentY.current = 0;
      return;
    }
    
    setTranslateY(deltaY);
    currentY.current = deltaY;
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Lower threshold for easier closing
    if (currentY.current > 80) {
      handleClose();
    } else {
      setTranslateY(0);
      currentY.current = 0;
    }
  };

  useEffect(() => {
    if (imgRef.current?.complete) setImageLoaded(true);
  }, []);

  // Sync state when the book prop changes (e.g., selection from lists)
  useEffect(() => {
    setCurrentBook(book);
    setDescription(book.description || '');
    setImageLoaded(false);
    setImageError(false);
    setSimilarBooks([]);
    setSimilarError(null);
    setRecommendedBooks([]);
    setRecommendedError(null);
    const scrollArea = document.getElementById('modal-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
  }, [book]);

  // Effect to fetch missing details (like zlibId) if not present
  useEffect(() => {
    if (!currentBook.zlibId && currentBook.md5) {
      console.log(`[Modal] zlibId missing for ${currentBook.md5}, fetching full details...`);
      setLoadingDetails(true);
      fetch(`/api/books/${currentBook.md5}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            console.log(`[Modal] Detail fetch success. New zlibId: ${res.data.zlibId}`);
            setCurrentBook(prev => ({
              ...prev,
              ...res.data,
              description: prev.description || res.data.description
            }));
          }
        })
        .catch(err => console.error('[Modal] Failed to fetch book details:', err))
        .finally(() => setLoadingDetails(false));
    } else if (currentBook.zlibId) {
      console.log(`[Modal] zlibId already present: ${currentBook.zlibId}`);
    }
  }, [currentBook.md5, currentBook.zlibId]);

  // Fetch Z-Library long description
  useEffect(() => {
    if (!description && currentBook.zlibId && currentBook.zlibHash) {
      const { zlibId, zlibHash, languages } = currentBook;
      const lang = (languages || 'en').toLowerCase();
      console.log(`[Modal] Fetching zlib-detail for ${zlibId}/${zlibHash}...`);
      
      fetch(`/api/zlib-detail/${lang}/${zlibId}/${zlibHash}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.description) {
            setDescription(data.description);
          }
        })
        .catch(() => {});
    }
  }, [currentBook.zlibId, currentBook.zlibHash, description]);

  // Fetch similar books
  useEffect(() => {
    if (currentBook.zlibId && currentBook.zlibHash) {
      console.log(`[Modal] Fetching similar books for ${currentBook.zlibId}/${currentBook.zlibHash}...`);
      setLoadingSimilar(true);
      setSimilarError(null);
      fetch(`/api/similar/${currentBook.zlibId}/${currentBook.zlibHash}`)
        .then(r => {
          if (r.status === 429) {
            setSimilarError('rate_limit');
            return r.json();
          }
          return r.json();
        })
        .then(data => {
          if (data.error === 'rate_limit') {
            setSimilarError('rate_limit');
            setSimilarBooks([]);
          } else if (data.success && data.data) {
            setSimilarBooks(data.data);
            setSimilarError(null);
          }
        })
        .catch(() => {
          setSimilarError(null);
        })
        .finally(() => setLoadingSimilar(false));
    } else {
      setSimilarBooks([]);
      setSimilarError(null);
    }
  }, [currentBook.zlibId, currentBook.zlibHash]);

  // Fetch recommended books
  // useEffect(() => {
  //   if (currentBook.zlibId) {
  //     console.log(`[Modal] Fetching recommended books for ${currentBook.zlibId}...`);
  //     setLoadingRecommended(true);
  //     setRecommendedError(null);
  //     fetch(`/api/recommended/${currentBook.zlibId}`)
  //       .then(r => {
  //         if (r.status === 429) {
  //           setRecommendedError('rate_limit');
  //           return r.json();
  //         }
  //         return r.json();
  //       })
  //       .then(data => {
  //         if (data.error === 'rate_limit') {
  //           setRecommendedError('rate_limit');
  //           setRecommendedBooks([]);
  //         } else if (data.success && data.data) {
  //           console.log(`[Modal] Recommended fetch success: ${data.data.length} books`);
  //           setRecommendedBooks(data.data);
  //           setRecommendedError(null);
  //         }
  //       })
  //       .catch(err => {
  //         console.error('[Modal] Recommended fetch failed:', err);
  //         setRecommendedError(null);
  //       })
  //       .finally(() => setLoadingRecommended(false));
  //   } else {
  //     setRecommendedBooks([]);
  //     setRecommendedError(null);
  //   }
  // }, [currentBook.zlibId]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/download/${currentBook.md5}?resolve=true`);
      if (!response.ok) throw new Error('Download failed');
      const data = await response.json();
      if (data.url) window.location.assign(data.url);
      else throw new Error('No URL returned');
    } catch (error) {
      console.error('Download error:', error);
      alert(t('book.download_error') || 'Could not start download');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEscape);
    
    // Prevent scrolling on html and body for better mobile support
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const container = ref.current;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const onScrollContainer = (ref: React.RefObject<HTMLDivElement | null>, type: 'similar' | 'recommended') => {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    
    if (type === 'similar') {
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      if (scrollWidth > clientWidth) {
        setScrollProgress((scrollLeft / (scrollWidth - clientWidth)) * 100);
      }
    } else {
      setCanRecScrollLeft(scrollLeft > 5);
      setCanRecScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      if (scrollWidth > clientWidth) {
        setRecScrollProgress((scrollLeft / (scrollWidth - clientWidth)) * 100);
      }
    }
  };

  useEffect(() => {
    // Initial check for scroll buttons
    const timer = setTimeout(() => {
      onScrollContainer(similarScrollRef, 'similar');
      onScrollContainer(recommendedScrollRef, 'recommended');
    }, 500);
    return () => clearTimeout(timer);
  }, [similarBooks, recommendedBooks, loadingSimilar, loadingRecommended]);

  const hasCover = currentBook.coverUrl && !imageError;

  const metaItems = [
    { icon: <Calendar size={11} />, value: currentBook.year },
    { icon: <Globe size={11} />,    value: currentBook.languages?.toUpperCase() },
    { icon: <FileText size={11} />, value: currentBook.format?.toUpperCase() },
    { icon: <HardDrive size={11} />,value: currentBook.size },
    { icon: <FileText size={11} />, value: currentBook.pages ? `${currentBook.pages} ${t('book.pages')}` : undefined },
  ].filter(m => m.value);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5 overscroll-none transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'animate-fade-in'}`}
      onClick={handleClose}
    >
      <div
        className={`flex flex-col w-full max-w-3xl overflow-hidden bg-white shadow-2xl rounded-t-3xl sm:rounded-3xl ${!isDragging ? 'transition-transform duration-300' : ''} ${isClosing ? '' : 'animate-slide-up'}`}
        style={{ maxHeight: '92vh', transform: `translateY(${translateY}px)` }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 bg-gray-200 rounded-full w-9" />
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden sm:flex-row">

          {/* ── Cover column ── */}
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-6 border-b border-gray-100 shrink-0 bg-gray-50 sm:w-52 sm:justify-start sm:border-b-0 sm:border-r sm:pt-10">

            {/* Book cover */}
            <div
              className="relative h-44 w-[116px] shrink-0 bg-stone-300 sm:h-56 sm:w-[148px]"
              style={{ borderRadius: '0 4px 4px 0' }}
            >
              <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 4px 4px 0' }}>

              {/* Fallback */}
              {(!hasCover || !imageLoaded) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-stone-400 to-stone-500">
                  <span className="line-clamp-5 text-[10px] font-medium leading-snug text-white/90">
                    {currentBook.title}
                  </span>
                </div>
              )}

              {hasCover && (
                <img
                  ref={imgRef}
                  src={currentBook.coverUrl}
                  alt={currentBook.title}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`relative z-[1] h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                  decoding="async"
                />
              )}
              </div>

              {/* Book Cover Overlay Style */}
              <div
                className="absolute inset-0 z-30 pointer-events-none "
                style={{
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
                  backgroundImage: `url("data:image/svg+xml,%0A%3Csvg width='6' height='150' viewBox='0 0 6 150' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='150' fill='url(%23paint0_linear)'/%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear' x1='6' y1='61.5234' x2='-9.54301e-06' y2='61.5315' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='white' stop-opacity='0'/%3E%3Cstop offset='0.139111' stop-color='white' stop-opacity='0.2'/%3E%3Cstop offset='0.290477' stop-opacity='0.18'/%3E%3Cstop offset='0.726819' stop-color='%23D8D8D8' stop-opacity='0.273181'/%3E%3Cstop offset='0.839352' stop-opacity='0.15'/%3E%3Cstop offset='1' stop-opacity='0.19'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E%0A")`,
                  backgroundRepeat: 'repeat-y',
                }}
              />
            </div>
          </div>

          {/* ── Detail column ── */}
          <div className="relative flex flex-col flex-1 min-w-0 min-h-0">

            {/* PINNED CLOSE BUTTON */}
            <button
              onClick={handleClose}
              aria-label="Close"
              className="absolute z-10 flex items-center justify-center w-8 h-8 text-gray-400 transition-all rounded-lg top-4 right-4 bg-white/80 backdrop-blur-sm sm:bg-transparent hover:bg-gray-100 hover:text-gray-600 active:scale-90"
            >
              <X size={20} />
            </button>

            {/* Content (Scrolls everything else) */}
            <div id="modal-scroll-area" className="flex flex-col flex-1 min-h-0 px-6 pt-5 pb-6 overflow-y-auto sm:pt-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">

              {/* Title */}
              <div className="pr-10 mb-2 shrink-0 flex items-start gap-3">
                <h2 className="text-xl font-semibold leading-snug tracking-tight pt-0.5 text-gray-900 sm:text-2xl">
                  {currentBook.title}
                </h2>
                {currentBook.isLocal && (
                  <div className="flex items-center justify-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 mt-0.5 rounded-lg text-sm sm:text-base font-bold uppercase tracking-wider shrink-0" title="Available Locally">
                    <DownloadCloud size={18} strokeWidth={2.5} /> LOCAL
                  </div>
                )}
              </div>

              {/* Author */}
              <p className="pr-8 mb-1 text-sm italic text-gray-400 shrink-0">
                {currentBook.author || t('book.unknown_author')}
              </p>

              {/* Publisher */}
              {currentBook.publisher && (
                <p className="pr-8 mb-1 text-xs text-gray-300 shrink-0">
                  {currentBook.publisher}
                </p>
              )}

              <div className="h-px my-4 bg-gray-100 shrink-0" />

              {/* Metadata chips */}
              {metaItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5 shrink-0">
                  {metaItems.map(({ icon, value }, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500"
                    >
                      <span className="text-gray-300">{icon}</span>
                      {value}
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              {description && (
                <div className="mb-5 shrink-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-300">
                    {t('book.description')}
                  </p>
                  <div className="pr-2">
                    <p className="text-sm leading-relaxed text-gray-500" dangerouslySetInnerHTML={{ __html: description }} />
                  </div>
                </div>
              )}

              {/* Tags */}
              {currentBook.tags && currentBook.tags.length > 0 && (
                <div className="mb-5 shrink-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-300">
                    {t('book.subject_tags')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentBook.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="cursor-default rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-gray-800 hover:text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* MD5 */}
              <p className="break-all font-mono text-[10px] text-gray-200 shrink-0">
                {currentBook.md5}
              </p>

              {/* Similar Books Section */}
              {(loadingSimilar || similarBooks.length > 0 || similarError) && (
                <div className="w-full min-w-0 mt-8 mb-4 overflow-visible shrink-0">
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-300 px-1">
                    {t('book.similar_books') || 'Similar Books'}
                  </p>
                  
                  {loadingSimilar ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="text-gray-200 animate-spin" />
                    </div>
                  ) : similarError === 'rate_limit' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="mb-2 text-sm text-gray-500">
                        {t('book.too_many_requests') || 'Too many requests'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('book.try_again_later') || 'Please try again later'}
                      </p>
                    </div>
                  ) : (
                    <div className="relative w-full min-w-0 group/carousel">
                      {/* Left Button */}
                      <button
                        onClick={() => scrollCarousel(similarScrollRef, 'left')}
                        className={`absolute left-0 top-[72px] z-50 items-center justify-center w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 text-gray-500 hover:text-gray-900 -translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer ${canScrollLeft ? 'lg:flex opacity-0 group-hover/carousel:opacity-100' : 'hidden'}`}
                        aria-label="Previous"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {/* Scroll Container */}
                      <div 
                        ref={similarScrollRef}
                        onScroll={() => onScrollContainer(similarScrollRef, 'similar')}
                        className="flex w-full gap-4 p-1 overflow-x-auto scrollbar-hide snap-x scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {similarBooks.map((simBook) => (
                          <div
                            key={simBook.id}
                            className="flex flex-col w-24 gap-2 cursor-pointer shrink-0 group/sim snap-start"
                            onClick={() => {
                              if (onBookSelect) {
                                onBookSelect(simBook);
                              }
                            }}
                          >
                            <div 
                              className="relative aspect-[2/3] w-full bg-stone-300 rounded-sm shadow-sm overflow-hidden transition-all group-hover/sim:-translate-y-1 group-hover/sim:shadow-md"
                              style={{ borderRadius: '0 2px 2px 0' }}
                            >
                                {!simBook.coverUrl && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-stone-400 to-stone-500">
                                    <span className="line-clamp-3 text-[8px] font-medium leading-tight text-white/90">
                                      {simBook.title}
                                    </span>
                                  </div>
                                )}
                                {simBook.coverUrl && (
                                  <img
                                    src={simBook.coverUrl}
                                    alt={simBook.title}
                                    className="w-full h-full object-cover relative z-[1]"
                                    loading="lazy"
                                  />
                                )}
                                <div
                                  className="absolute inset-0 z-30 pointer-events-none"
                                  style={{
                                    borderRadius: '0 2px 2px 0',
                                    boxShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                                    backgroundImage: `url("data:image/svg+xml,%0A%3Csvg width='6' height='150' viewBox='0 0 6 150' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='150' fill='url(%23paint0_linear)'/%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear' x1='6' y1='61.5234' x2='-9.54301e-06' y2='61.5315' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='white' stop-opacity='0'/%3E%3Cstop offset='0.139111' stop-color='white' stop-opacity='0.2'/%3E%3Cstop offset='0.290477' stop-opacity='0.18'/%3E%3Cstop offset='0.726819' stop-color='%23D8D8D8' stop-opacity='0.273181'/%3E%3Cstop offset='0.839352' stop-opacity='0.15'/%3E%3Cstop offset='1' stop-opacity='0.19'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E%0A")`,
                                    backgroundRepeat: 'repeat-y',
                                  }}
                                />
                            </div>
                            <p className="text-[10px] font-medium text-gray-700 line-clamp-2 leading-tight group-hover/sim:text-accent">
                              {simBook.title}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Right Button */}
                      <button
                        onClick={() => scrollCarousel(similarScrollRef, 'right')}
                        className={`absolute right-0 top-[72px] z-50 items-center justify-center w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 text-gray-500 hover:text-gray-900 translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer ${canScrollRight ? 'lg:flex opacity-0 group-hover/carousel:opacity-100' : 'hidden'}`}
                        aria-label="Next"
                      >
                        <ChevronRight size={16} />
                      </button>

                      {/* Progress Indicator */}
                      {similarBooks.length > 4 && (
                        <div className="px-1 mt-4">
                          <div className="h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all duration-300 ease-out rounded-full bg-accent"
                              style={{ width: `${scrollProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Books Section */}
              {(loadingRecommended || recommendedBooks.length > 0 || recommendedError) && (
                <div className="w-full min-w-0 mt-8 mb-4 overflow-visible shrink-0">
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-300 px-1">
                    Recommended Books
                  </p>
                  
                  {loadingRecommended ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="text-gray-200 animate-spin" />
                    </div>
                  ) : recommendedError === 'rate_limit' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="mb-2 text-sm text-gray-500">
                        {t('book.too_many_requests') || 'Too many requests'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('book.try_again_later') || 'Please try again later'}
                      </p>
                    </div>
                  ) : (
                    <div className="relative w-full min-w-0 group/carousel">
                      {/* Left Button */}
                      <button
                        onClick={() => scrollCarousel(recommendedScrollRef, 'left')}
                        className={`absolute left-0 top-[72px] z-50 items-center justify-center w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 text-gray-500 hover:text-gray-900 -translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer ${canRecScrollLeft ? 'lg:flex opacity-0 group-hover/carousel:opacity-100' : 'hidden'}`}
                        aria-label="Previous"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {/* Scroll Container */}
                      <div 
                        ref={recommendedScrollRef}
                        onScroll={() => onScrollContainer(recommendedScrollRef, 'recommended')}
                        className="flex w-full gap-4 p-1 overflow-x-auto scrollbar-hide snap-x scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {recommendedBooks.map((recBook) => (
                          <div
                            key={recBook.id}
                            className="flex flex-col w-24 gap-2 cursor-pointer shrink-0 group/sim snap-start"
                            onClick={() => {
                              if (onBookSelect) {
                                onBookSelect(recBook);
                              }
                            }}
                          >
                            <div 
                              className="relative aspect-[2/3] w-full bg-stone-300 rounded-sm shadow-sm overflow-hidden transition-all group-hover/sim:-translate-y-1 group-hover/sim:shadow-md"
                              style={{ borderRadius: '0 2px 2px 0' }}
                            >
                                {!recBook.coverUrl && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-stone-400 to-stone-500">
                                    <span className="line-clamp-3 text-[8px] font-medium leading-tight text-white/90">
                                      {recBook.title}
                                    </span>
                                  </div>
                                )}
                                {recBook.coverUrl && (
                                  <img
                                    src={recBook.coverUrl}
                                    alt={recBook.title}
                                    className="w-full h-full object-cover relative z-[1]"
                                    loading="lazy"
                                  />
                                )}
                                <div
                                  className="absolute inset-0 z-30 pointer-events-none"
                                  style={{
                                    borderRadius: '0 2px 2px 0',
                                    boxShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                                    backgroundImage: `url("data:image/svg+xml,%0A%3Csvg width='6' height='150' viewBox='0 0 6 150' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='150' fill='url(%23paint0_linear)'/%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear' x1='6' y1='61.5234' x2='-9.54301e-06' y2='61.5315' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='white' stop-opacity='0'/%3E%3Cstop offset='0.139111' stop-color='white' stop-opacity='0.2'/%3E%3Cstop offset='0.290477' stop-opacity='0.18'/%3E%3Cstop offset='0.726819' stop-color='%23D8D8D8' stop-opacity='0.273181'/%3E%3Cstop offset='0.839352' stop-opacity='0.15'/%3E%3Cstop offset='1' stop-opacity='0.19'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E%0A")`,
                                    backgroundRepeat: 'repeat-y',
                                  }}
                                />
                            </div>
                            <p className="text-[10px] font-medium text-gray-700 line-clamp-2 leading-tight group-hover/sim:text-accent">
                              {recBook.title}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Right Button */}
                      <button
                        onClick={() => scrollCarousel(recommendedScrollRef, 'right')}
                        className={`absolute right-0 top-[72px] z-50 items-center justify-center w-8 h-8 rounded-full bg-white shadow-xl border border-gray-100 text-gray-500 hover:text-gray-900 translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer ${canRecScrollRight ? 'lg:flex opacity-0 group-hover/carousel:opacity-100' : 'hidden'}`}
                        aria-label="Next"
                      >
                        <ChevronRight size={16} />
                      </button>

                      {/* Progress Indicator */}
                      {recommendedBooks.length > 4 && (
                        <div className="px-1 mt-4">
                          <div className="h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all duration-300 ease-out rounded-full bg-accent"
                              style={{ width: `${recScrollProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Download — pinned */}
            <div className="px-6 pt-3 shrink-0 bg-gradient-to-t from-white via-white to-transparent pb-7">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 ${
                  isDownloading
                    ? 'cursor-wait bg-gray-400'
                    : 'bg-gray-900 hover:-translate-y-px hover:bg-gray-800 hover:shadow-xl active:scale-[0.98]'
                }`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('book.preparing_download') || 'Preparing…'}
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    {t('book.download')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}