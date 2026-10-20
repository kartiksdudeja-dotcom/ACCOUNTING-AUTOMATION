import React, { useState, useEffect, useRef } from "react";
import {
  Folder, File, FileText, Image as ImageIcon, Grid as GridIcon, List as ListIcon,
  Search, Upload, Plus, Download, Trash2, Edit3, ChevronRight,
  FileSpreadsheet, X, Eye, FileArchive, FolderPlus
} from "lucide-react";
import "./Documents.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Documents({ showToast }) {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null); // null means root
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // file or folder for details panel
  const [isDragging, setIsDragging] = useState(false);
  
  // Modals
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFolders();
    fetchFiles();
  }, [currentFolder]);

  const fetchFolders = async () => {
    try {
      let url = `${API_URL}/documents/folders?`;
      if (currentFolder) {
        url += `parent_id=${currentFolder.id}`;
      } else {
        url += `parent_id=0`;
      }
      const res = await fetch(url);
      if (res.ok) setFolders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFiles = async () => {
    try {
      let url = `${API_URL}/documents/files?`;
      if (currentFolder) {
        url += `folder_id=${currentFolder.id}`;
      } else {
        url += `folder_id=0`;
      }
      const res = await fetch(url);
      if (res.ok) setFiles(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const formData = new FormData();
      formData.append("name", newFolderName);
      if (currentFolder) formData.append("parent_id", currentFolder.id);

      const res = await fetch(`${API_URL}/documents/folders`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        showToast("Folder created successfully");
        setIsCreateFolderModalOpen(false);
        setNewFolderName("");
        fetchFolders();
      }
    } catch (err) {
      showToast("Error creating folder", "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (currentFolder) formData.append("folder_id", currentFolder.id);

    try {
      const res = await fetch(`${API_URL}/documents/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        showToast("File uploaded successfully");
        fetchFiles();
      } else {
        showToast("Upload failed", "error");
      }
    } catch (err) {
      showToast("Error uploading file", "error");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolder) formData.append("folder_id", currentFolder.id);

      try {
        const res = await fetch(`${API_URL}/documents/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          showToast("File uploaded successfully");
          fetchFiles();
        } else {
          showToast("Upload failed", "error");
        }
      } catch (err) {
        showToast("Error uploading file", "error");
      }
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Delete this ${type}?`)) return;
    try {
      const endpoint = type === "folder" ? "folders" : "files";
      const res = await fetch(`${API_URL}/documents/${endpoint}/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast(`${type} deleted`);
        if (type === "folder") fetchFolders();
        else fetchFiles();
        if (selectedItem?.id === id) setSelectedItem(null);
      }
    } catch (err) {
      showToast(`Error deleting ${type}`, "error");
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return <File size={24} />;
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return <FileText size={24} style={{color: "#ef4444"}} />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={24} style={{color: "#10b981"}} />;
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) return <ImageIcon size={24} style={{color: "#3b82f6"}} />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return <FileArchive size={24} style={{color: "#f59e0b"}} />;
    return <File size={24} style={{color: "#8b5cf6"}} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric"
    });
  };

  const openCreateFolder = () => {
    setNewFolderName("");
    setIsCreateFolderModalOpen(true);
    setIsPlusMenuOpen(false);
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="documents-container glass-panel">
      
      {/* LEFT SIDEBAR - HIERARCHY */}
      <div className="doc-sidebar">
        <div className="doc-sidebar-header">
          <div className="plus-menu-container">
            <button className="btn-create-new" onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}>
              <Plus size={18} /> New
            </button>
            {isPlusMenuOpen && (
              <div className="plus-dropdown glass-dropdown">
                <button onClick={openCreateFolder}><FolderPlus size={16}/> New Folder</button>
                <div className="divider"></div>
                <button onClick={() => { fileInputRef.current.click(); setIsPlusMenuOpen(false); }}><Upload size={16}/> Upload File</button>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
        </div>

        <div className="doc-nav">
          <div className={`doc-nav-item ${!currentFolder ? "active" : ""}`} onClick={() => setCurrentFolder(null)}>
            <ChevronRight size={16} /> <Folder size={18} /> My Drive
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="doc-main">
        {/* Top bar */}
        <div className="doc-topbar">
          <div className="breadcrumb">
            <span className="crumb" onClick={() => setCurrentFolder(null)}>My Drive</span>
            {currentFolder && (
              <>
                <span className="separator">/</span>
                <span className="crumb active">{currentFolder.name}</span>
              </>
            )}
          </div>

          <div className="doc-controls">
            <div className="search-box">
              <Search size={16} />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="view-toggle">
              <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><ListIcon size={18}/></button>
              <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}><GridIcon size={18}/></button>
            </div>
          </div>
        </div>

        {/* Action bar for current folder */}
        {currentFolder && (
          <div className="folder-actions">
            <button onClick={openCreateFolder} className="btn-outline"><FolderPlus size={14}/> New Folder</button>
            <button onClick={() => fileInputRef.current.click()} className="btn-outline"><Upload size={14}/> Upload File</button>
          </div>
        )}

        {/* Files & Folders Grid/List */}
        <div 
          className={`doc-content-area ${viewMode} ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="drag-overlay">
              <Upload size={48} />
              <h2>Drop files here to upload</h2>
            </div>
          )}

          {filteredFolders.length === 0 && filteredFiles.length === 0 && !isDragging && (
            <div className="empty-state">No folders or files found. Drag and drop files here.</div>
          )}

          {/* Folders */}
          {filteredFolders.length > 0 && <h3 className="section-title">Folders</h3>}
          <div className="items-container">
            {filteredFolders.map(folder => (
              <div 
                key={folder.id} 
                className={`doc-item folder-item ${selectedItem?.id === folder.id && selectedItem?.type === 'folder' ? 'selected' : ''}`}
                onClick={() => setSelectedItem({ ...folder, type: 'folder' })}
                onDoubleClick={() => setCurrentFolder(folder)}
              >
                <div className="item-icon"><Folder size={viewMode === 'grid' ? 40 : 20} style={{fill: "var(--primary)", color: "var(--primary)"}} /></div>
                <div className="item-info">
                  <div className="item-name">{folder.name}</div>
                  {viewMode === 'list' && <div className="item-date">{formatDate(folder.created_at)}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Files */}
          {filteredFiles.length > 0 && <h3 className="section-title" style={{marginTop: "20px"}}>Files</h3>}
          <div className="items-container">
            {filteredFiles.map(file => (
              <div 
                key={file.id} 
                className={`doc-item file-item ${selectedItem?.id === file.id && selectedItem?.type === 'file' ? 'selected' : ''}`}
                onClick={() => setSelectedItem({ ...file, type: 'file' })}
              >
                <div className="item-icon">{getFileIcon(file.name)}</div>
                <div className="item-info">
                  <div className="item-name" title={file.name}>{file.name}</div>
                  {viewMode === 'list' && (
                    <>
                      <div className="item-size">{formatSize(file.file_size)}</div>
                      <div className="item-date">{formatDate(file.created_at)}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - DETAILS */}
      {selectedItem && (
        <div className="doc-details-panel">
          <div className="details-header">
            <h3>{selectedItem.type === 'file' ? <FileText size={18}/> : <Folder size={18}/>} Details</h3>
            <button onClick={() => setSelectedItem(null)} className="icon-btn"><X size={18}/></button>
          </div>
          
          <div className="details-preview">
            {selectedItem.type === 'folder' ? (
              <Folder size={64} style={{color: "var(--primary)"}}/>
            ) : (
              getFileIcon(selectedItem.name)
            )}
            <h4 className="details-title">{selectedItem.name}</h4>
          </div>

          <div className="details-info-list">
            <div className="info-row">
              <span>Type</span>
              <span>{selectedItem.type === 'folder' ? 'Folder' : selectedItem.file_type || 'Unknown'}</span>
            </div>
            {selectedItem.type === 'file' && (
              <div className="info-row">
                <span>Size</span>
                <span>{formatSize(selectedItem.file_size)}</span>
              </div>
            )}
            <div className="info-row">
              <span>Created</span>
              <span>{formatDate(selectedItem.created_at)}</span>
            </div>
          </div>

          <div className="details-actions">
            {selectedItem.type === 'file' && (
              <>
                <a href={`${API_URL}/documents/files/${selectedItem.id}/download`} target="_blank" rel="noreferrer" className="btn-action primary">
                  <Eye size={16}/> Preview
                </a>
                <a href={`${API_URL}/documents/files/${selectedItem.id}/download`} download className="btn-action">
                  <Download size={16}/> Download
                </a>
              </>
            )}
            <button className="btn-action" onClick={async () => {
               const newName = prompt("Enter new name:", selectedItem.name);
               if(newName) {
                 const endpoint = selectedItem.type === "folder" ? "folders" : "files";
                 const formData = new FormData();
                 formData.append("name", newName);
                 const res = await fetch(`${API_URL}/documents/${endpoint}/${selectedItem.id}`, {
                   method: "PUT",
                   body: formData
                 });
                 if(res.ok) {
                   showToast("Renamed successfully");
                   if(selectedItem.type === "folder") fetchFolders();
                   else fetchFiles();
                   setSelectedItem({ ...selectedItem, name: newName });
                 }
               }
            }}>
              <Edit3 size={16}/> Rename
            </button>
            <button className="btn-action danger" onClick={() => handleDelete(selectedItem.type, selectedItem.id)}>
              <Trash2 size={16}/> Delete
            </button>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isCreateFolderModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-modal">
            <div className="modal-header">
              <h3>Create Folder</h3>
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="icon-btn"><X size={18}/></button>
            </div>
            <div className="modal-body">
              <input 
                type="text" 
                placeholder="Folder Name" 
                className="modal-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if(e.key === 'Enter') handleCreateFolder(); }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsCreateFolderModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
