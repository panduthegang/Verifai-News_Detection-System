// Import Firestore functions for interacting with the database
import { 
  collection, // Function to reference a Firestore collection
  query, // Function to create a Firestore query
  orderBy, // Function to sort query results
  limit, // Function to limit the number of query results
  addDoc, // Function to add a new document to a collection
  deleteDoc, // Function to delete a document
  doc, // Function to reference a specific Firestore document
  getDocs, // Function to fetch documents from a query or collection
  startAfter, // Function for pagination - start after a document
  DocumentSnapshot, // Type for document snapshots
} from 'firebase/firestore';
import { db } from './firebase'; // Import the Firestore database instance configured in firebase.js
import { HistoricalAnalysis } from '@/utils/types'; // Type definition for historical analysis data

// Save a new analysis to the user's history in Firestore
export const saveAnalysis = async (userId: string, analysis: HistoricalAnalysis) => {
  try {
    // Reference the user's history subcollection in Firestore
    const userHistoryRef = collection(db, 'users', userId, 'history');
    
    // Extract ID and spread the rest to avoid saving redundant or misleading 'id' inside data
    const { id, ...analysisData } = analysis;
    
    // Add a new document with the analysis data and a timestamp
    await addDoc(userHistoryRef, {
      ...analysisData,
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log the error and rethrow it for the caller to handle
    console.error('Error saving analysis:', error);
    throw error;
  }
};

// Fetch the user's analysis history from Firestore with pagination support
export const getAnalysisHistory = async (
  userId: string, 
  pageSize: number = 10, 
  lastDoc?: DocumentSnapshot
): Promise<{ analyses: HistoricalAnalysis[], lastDocument: DocumentSnapshot | null, hasMore: boolean }> => {
  try {
    // Reference the user's history subcollection in Firestore
    const userHistoryRef = collection(db, 'users', userId, 'history');
    
    // Create a query with pagination support
    let q = query(
      userHistoryRef,
      orderBy('timestamp', 'desc'),
      limit(pageSize + 1) // Fetch one extra to check if there are more
    );
    
    // If we have a last document, start after it for pagination
    if (lastDoc) {
      q = query(
        userHistoryRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(pageSize + 1)
      );
    }
    
    // Execute the query and get the resulting documents
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    
    // Check if there are more documents
    const hasMore = docs.length > pageSize;
    
    // Get the actual results (excluding the extra one used for hasMore check)
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
    
    // Map the documents to HistoricalAnalysis objects, including the document ID
    const analyses = resultDocs.map(doc => {
      const data = doc.data();
      // Remove any internal id field if it exists in the data to avoid confusion
      const { id, ...rest } = data as any;
      return {
        ...rest,
        id: doc.id
      } as HistoricalAnalysis;
    });
    
    // Get the last document for next pagination
    const lastDocument = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;
    
    return {
      analyses,
      lastDocument,
      hasMore
    };
  } catch (error) {
    // Log the error and rethrow it for the caller to handle
    console.error('Error fetching analysis history:', error);
    throw error;
  }
};

// Delete a specific analysis from the user's history in Firestore
export const deleteAnalysis = async (userId: string, analysisId: string) => {
  try {
    // Reference the specific analysis document in the user's history subcollection
    const analysisRef = doc(db, 'users', userId, 'history', analysisId);
    // Delete the document from Firestore
    await deleteDoc(analysisRef);
  } catch (error) {
    // Log the error and rethrow it for the caller to handle
    console.error('Error deleting analysis:', error);
    throw error;
  }
};