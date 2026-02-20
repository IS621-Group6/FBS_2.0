export default function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null

  const canPrev = page > 1
  const canNext = page < pageCount

  return (
    <div className="pagination" aria-label="Pagination">
      <button className="btn" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      <span className="pill" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <button className="btn" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  )
}
