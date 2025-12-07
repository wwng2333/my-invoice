export const state = {
    // Selection related
    selected: new Set(),
    totalAmount: 0,
    
    // Current editing
    currentAttachments: [],
    currentRecord: null,
    
    // Pagination and sorting
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 0,
    sortBy: "invoice_date",
    sortOrder: "desc"
};
